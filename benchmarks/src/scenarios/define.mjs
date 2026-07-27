// Shared scenario machinery. Family modules under this directory import these
// helpers directly and export a plain array, rather than exporting a factory
// that receives the helpers as an argument: nothing here depends on the family,
// so the extra indirection would buy no isolation and only add a call layer
// between a scenario list and the report it produces.

const explicitIssuePolicies = new Set(['first', 'all'])

export function canonicalizeOutput(value) {
	if (value instanceof Map)
		return { type: 'Map', entries: [...value].map(([key, item]) => [canonicalizeOutput(key), canonicalizeOutput(item)]) }
	if (value instanceof Set)
		return { type: 'Set', values: [...value].map(canonicalizeOutput) }
	// A Date has no own enumerable properties, so the generic object branch below
	// would canonicalize every Date to `{}` and compare all of them as equal.
	if (value instanceof Date)
		return { type: 'Date', time: value.getTime() }
	if (Array.isArray(value))
		return value.map(canonicalizeOutput)
	if (value != null && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value)
			.map(([key, item]) => [key, canonicalizeOutput(item)]))
	}
	return value
}

export function assertResult(adapter, rawResult, expected) {
	const normalized = adapter.normalize(rawResult)
	if (normalized.success !== expected.success)
		throw new Error(`${adapter.name}: expected success=${expected.success}, received ${normalized.success}`)

	if (expected.output !== undefined) {
		const actual = JSON.stringify(canonicalizeOutput(normalized.output))
		const wanted = JSON.stringify(canonicalizeOutput(expected.output))
		if (actual !== wanted)
			throw new Error(`${adapter.name}: output mismatch. Expected ${wanted}, received ${actual}`)
	}

	if (expected.issueCount !== undefined && normalized.issueCount !== expected.issueCount) {
		throw new Error(`${adapter.name}: expected ${expected.issueCount} issues, received ${normalized.issueCount ?? 'unknown'}`)
	}
}

export function benchmarkGroup(category, resultKind, issuePolicy) {
	if (category !== 'warm')
		return category
	if (resultKind === 'success')
		return 'warm/success'
	return `warm/failure/${issuePolicy}`
}

// A feature name exists only for a schema capability that at least one adapter
// genuinely lacks, so an adapter's `capabilities.features` list stays short and
// every entry is a real claim. A scenario that requires a feature is skipped
// with a reason for adapters that do not declare it, rather than approximated
// with a hand-rolled stand-in that would compare different work.
export function featureSupportFor(adapter, requiredFeatures) {
	if (requiredFeatures.length === 0)
		return { supported: true, reason: null }
	const supportedFeatures = adapter.capabilities?.features ?? []
	const missing = requiredFeatures.filter(feature => !supportedFeatures.includes(feature))
	return missing.length === 0
		? { supported: true, reason: null }
		: {
				supported: false,
				reason: `${adapter.name} has no benchmark-equivalent ${missing.join(', ')} schema`,
			}
}

export function supportFor(adapter, issuePolicy, requiredFeatures) {
	const featureSupport = featureSupportFor(adapter, requiredFeatures)
	if (!featureSupport.supported)
		return featureSupport
	if (!explicitIssuePolicies.has(issuePolicy))
		return { supported: true, reason: null }
	const supportedPolicies = adapter.capabilities?.issuePolicies ?? []
	return supportedPolicies.includes(issuePolicy)
		? { supported: true, reason: null }
		: {
				supported: false,
				reason: `${adapter.name} does not expose a benchmark-equivalent ${issuePolicy}-issue policy`,
			}
}

// `steps` names the Valchecker public step methods the scenario's Valchecker
// schema calls, so step coverage of the suite is machine-checkable instead of
// inferred from scenario ids. It is required rather than optional: a scenario
// that forgets it would silently look like a step nothing exercises.
function normalizeSteps(id, steps) {
	if (!Array.isArray(steps) || steps.length === 0) {
		throw new TypeError(
			`Scenario '${id}' must declare a non-empty \`steps\` array naming the Valchecker step methods its schema calls.`,
		)
	}
	for (const step of steps) {
		if (typeof step !== 'string' || step.length === 0) {
			throw new TypeError(
				`Scenario '${id}' declares the \`steps\` entry ${JSON.stringify(step)}; every entry must be a non-empty Valchecker step-method name.`,
			)
		}
	}
	return steps
}

export function defineScenario({
	id,
	category,
	tier,
	buildKey,
	steps,
	resultKind,
	issuePolicy,
	comparisonScope,
	diagnosticIssueCount,
	requiredFeatures = [],
	createOperation,
}) {
	const group = benchmarkGroup(category, resultKind, issuePolicy)
	return {
		id,
		category,
		tier,
		group,
		resultKind,
		issuePolicy,
		comparisonScope,
		diagnosticIssueCount,
		requiredFeatures,
		buildKey,
		steps: normalizeSteps(id, steps),
		support(adapter) {
			return supportFor(adapter, issuePolicy, requiredFeatures)
		},
		setup(adapter) {
			// A missing build key means the adapter and the scenario disagree about
			// what is supported. Fail loudly instead of letting a forgotten feature
			// declaration silently shrink the compared set.
			if (typeof adapter.build[buildKey] !== 'function') {
				throw new TypeError(
					`${adapter.name} has no build key '${buildKey}' required by scenario '${id}'. `
					+ 'Add the build, or declare the missing capability with requiredFeatures.',
				)
			}
			return createOperation(adapter, { issuePolicy, comparisonScope, resultKind })
		},
	}
}

export function construction(id, tier, buildKey, correctnessInput, expected = { success: true }, options = {}) {
	return defineScenario({
		id,
		category: 'construction',
		tier,
		buildKey,
		steps: options.steps,
		resultKind: expected.success ? 'success' : 'failure',
		issuePolicy: options.issuePolicy ?? 'not-applicable',
		comparisonScope: options.comparisonScope ?? 'equivalent',
		diagnosticIssueCount: expected.issueCount ?? null,
		requiredFeatures: options.requiredFeatures,
		createOperation(adapter, context) {
			const verifySchema = adapter.build[buildKey](context)
			assertResult(adapter, adapter.parse(verifySchema, correctnessInput, context), expected)
			return () => adapter.build[buildKey](context)
		},
	})
}

export function cold(id, tier, buildKey, input, expected, options = {}) {
	return defineScenario({
		id,
		category: 'cold',
		tier,
		buildKey,
		steps: options.steps,
		resultKind: expected.success ? 'success' : 'failure',
		issuePolicy: options.issuePolicy ?? (expected.success ? 'not-applicable' : 'library-default'),
		comparisonScope: options.comparisonScope ?? (expected.success ? 'equivalent' : 'library-defaults'),
		diagnosticIssueCount: expected.issueCount ?? null,
		requiredFeatures: options.requiredFeatures,
		createOperation(adapter, context) {
			const operation = () => adapter.parse(adapter.build[buildKey](context), input, context)
			assertResult(adapter, operation(), expected)
			return operation
		},
	})
}

export function warm(id, tier, buildKey, input, expected, options = {}) {
	return defineScenario({
		id,
		category: 'warm',
		tier,
		buildKey,
		steps: options.steps,
		resultKind: expected.success ? 'success' : 'failure',
		issuePolicy: options.issuePolicy ?? (expected.success ? 'not-applicable' : 'library-default'),
		comparisonScope: options.comparisonScope ?? (expected.success ? 'equivalent' : 'library-defaults'),
		diagnosticIssueCount: expected.issueCount ?? null,
		requiredFeatures: options.requiredFeatures,
		createOperation(adapter, context) {
			const schema = adapter.build[buildKey](context)
			const operation = () => adapter.parse(schema, input, context)
			assertResult(adapter, operation(), expected)
			return operation
		},
	})
}

export function warmPool(id, tier, buildKey, inputs, expected, options = {}) {
	return defineScenario({
		id,
		category: 'warm',
		tier,
		buildKey,
		steps: options.steps,
		resultKind: expected.success ? 'success' : 'failure',
		issuePolicy: options.issuePolicy ?? (expected.success ? 'not-applicable' : 'library-default'),
		comparisonScope: options.comparisonScope ?? (expected.success ? 'equivalent' : 'library-defaults'),
		diagnosticIssueCount: expected.issueCount ?? null,
		requiredFeatures: options.requiredFeatures,
		createOperation(adapter, context) {
			const schema = adapter.build[buildKey](context)
			for (const input of inputs)
				assertResult(adapter, adapter.parse(schema, input, context), expected)
			let index = 0
			return () => {
				const input = inputs[index % inputs.length]
				index++
				return adapter.parse(schema, input, context)
			}
		},
	})
}

export function issuePolicyPair(structure, buildKey, input, options = {}) {
	const comparisonScope = options.comparisonScope ?? 'equivalent'
	const allIssueCount = options.allIssueCount ?? 2
	const tier = options.tier ?? 'standard'
	return [
		warm(
			`issue-policy/${structure}/invalid/first`,
			tier,
			buildKey,
			input,
			{ success: false, issueCount: 1 },
			{ issuePolicy: 'first', comparisonScope, requiredFeatures: options.requiredFeatures, steps: options.steps },
		),
		warm(
			`issue-policy/${structure}/invalid/all`,
			tier,
			buildKey,
			input,
			{ success: false, issueCount: allIssueCount },
			{ issuePolicy: 'all', comparisonScope, requiredFeatures: options.requiredFeatures, steps: options.steps },
		),
	]
}
