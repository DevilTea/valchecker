// Shared scenario machinery. Family modules under this directory import these
// helpers directly and export a plain array, rather than exporting a factory
// that receives the helpers as an argument: nothing here depends on the family,
// so the extra indirection would buy no isolation and only add a call layer
// between a scenario list and the report it produces.

const explicitIssuePolicies = new Set(['first', 'all'])

// Symbols compare by identity, not by description: two `Symbol('x')` are
// different values. `canonicalizeOutput` therefore gives each distinct symbol a
// stable index within the process instead of using its description, which two
// unrelated symbols can share. The indices only ever have to separate the actual
// output from the expected one inside a single `assertResult` call, so the map is
// small and its numbering does not have to mean anything across calls.
const symbolIdentities = new Map()

function symbolIdentity(value) {
	if (!symbolIdentities.has(value))
		symbolIdentities.set(value, symbolIdentities.size)
	return symbolIdentities.get(value)
}

export function canonicalizeOutput(value) {
	if (value instanceof Map)
		return { type: 'Map', entries: [...value].map(([key, item]) => [canonicalizeOutput(key), canonicalizeOutput(item)]) }
	if (value instanceof Set)
		return { type: 'Set', values: [...value].map(canonicalizeOutput) }
	// A Date has no own enumerable properties, so the generic object branch below
	// would canonicalize every Date to `{}` and compare all of them as equal.
	if (value instanceof Date)
		return { type: 'Date', time: value.getTime() }
	// `JSON.stringify` throws on a bigint, so without this branch a bigint output
	// could not be asserted at all — which is exactly what the bigint conversion
	// scenarios produce.
	if (typeof value === 'bigint')
		return { type: 'BigInt', digits: value.toString() }
	// `JSON.stringify` maps a top-level symbol to `undefined` rather than throwing,
	// so without this branch every symbol output would serialize to the same thing
	// as every other symbol — and as no output at all — and the `symbol` scenario's
	// output assertion would pass without asserting anything.
	if (typeof value === 'symbol')
		return { type: 'Symbol', identity: symbolIdentity(value) }
	if (Array.isArray(value))
		return value.map(canonicalizeOutput)
	if (value != null && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value)
			.map(([key, item]) => [key, canonicalizeOutput(item)]))
	}
	return value
}

function isThenable(value) {
	return value != null && typeof value.then === 'function'
}

/** The Standard Schema V1 call, identical on every library that implements it. */
function standardValidate(schema, input) {
	return schema['~standard'].validate(input)
}

// How a scenario reaches the library under test.
//
// `native` is each library's own entry point, spelled by its adapter:
// `schema.execute()`, `schema.safeParse()`/`safeParseAsync()`, and Valibot's
// `safeParse()`/`safeParseAsync()`.
//
// `standard` is the Standard Schema V1 entry point that all four libraries expose
// as `schema['~standard'].validate(input)` — the path a tRPC or TanStack Form user
// takes instead of the library's own parse. Both the call and the result shape live
// here rather than in four adapters because they are one specified contract rather
// than four spellings; a per-adapter copy could only introduce a difference the
// specification forbids. An adapter still decides everything about the schema, so
// the comparison stays like-for-like with the native rows over the same build key.
const entryPoints = {
	// `adapter.parse` is *referenced*, not wrapped. A native cell's timed closure
	// then calls exactly the function it called before this file learned about a
	// second entry point, so no existing measurement pays a call frame for the
	// interop entry existing next to it. Every adapter's `parse` is a plain function
	// that does not read `this`.
	native: {
		resolveCall: adapter => adapter.parse,
		normalize: (adapter, result) => adapter.normalize(result),
	},
	standard: {
		resolveCall: () => standardValidate,
		// Success is the absence of `issues`, which is what the specification says and
		// not the same as the presence of `value`: executed against the four pins,
		// Valibot returns `{ value, typed, issues }` for a failure whose input was of
		// the right type, so a `'value' in result` test would call it a success. Zod and
		// Valchecker return `{ value }` or `{ issues }`.
		normalize: (adapter, result) => (result.issues == null
			? { success: true, output: result.value, issueCount: 0 }
			: { success: false, issueCount: result.issues.length }),
	},
}

function resolveEntry(adapter, entry) {
	const entryPoint = entryPoints[entry]
	if (entryPoint === undefined)
		throw new TypeError(`Unknown scenario entry point: ${entry}`)
	return {
		call: entryPoint.resolveCall(adapter),
		normalize: result => entryPoint.normalize(adapter, result),
	}
}

export function assertResult(adapter, rawResult, expected, normalizeResult) {
	// A promise here means the scenario is asynchronous but was not declared so, in
	// which case `measure` would time promise creation and publish it as validation
	// throughput. Fail with the fix rather than with a `TypeError` from inside a
	// normalizer that was handed a promise.
	if (isThenable(rawResult)) {
		throw new TypeError(
			`${adapter.name}: the operation returned a promise for a scenario declared synchronous. `
			+ 'Declare `executionMode: \'async\'` so the await happens inside the timed loop.',
		)
	}
	const normalized = normalizeResult == null ? adapter.normalize(rawResult) : normalizeResult(rawResult)
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

// Asynchronous cells get their own groups. A group is the unit every aggregate in
// the suite is computed over — the summary's snapshot table and the geometric means
// behind the performance-impact verdict — and an awaited validation and a
// synchronous one are different work, for the same reason `warm/failure/first` is
// kept apart from `warm/failure/all`. Separating them at the group makes that
// separation structural instead of something each report has to remember.
export function benchmarkGroup(category, resultKind, issuePolicy, executionMode) {
	const prefix = executionMode === 'async' ? `${category}/async` : category
	if (category !== 'warm')
		return prefix
	if (resultKind === 'success')
		return `${prefix}/success`
	return `${prefix}/failure/${issuePolicy}`
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

// `executionMode` says how the cell is measured: `sync` times the operation
// directly, `async` awaits it inside the timed loop. It is declared rather than
// detected, because detection cannot tell the two apart honestly — a Valchecker
// maybe-async pipeline returns a promise for some inputs and a plain result for
// others, so a probe would classify a cell by its fixture. What the harness does
// check is that the declaration matches reality: the verification below rejects a
// promise from a sync scenario, and `measureAsync` rejects a non-promise from an
// async one.
function normalizeExecutionMode(id, executionMode) {
	if (executionMode !== 'sync' && executionMode !== 'async')
		throw new TypeError(`Scenario '${id}' declares the unknown executionMode ${JSON.stringify(executionMode)}; use 'sync' or 'async'.`)
	return executionMode
}

/**
 * Verifies one raw result, awaiting it for an async scenario. Returns `undefined`
 * when the check completed synchronously and a promise when it did not, so a
 * scenario helper can hand either straight back without a second code path.
 */
function verifyResult(adapter, entry, rawResult, expected, executionMode) {
	if (executionMode !== 'async') {
		assertResult(adapter, rawResult, expected, entry.normalize)
		return undefined
	}
	if (!isThenable(rawResult)) {
		throw new TypeError(
			`${adapter.name}: the operation returned a synchronous result for a scenario declared asynchronous. `
			+ 'Either the schema is not async on this adapter, or the scenario should be `executionMode: \'sync\'`.',
		)
	}
	return Promise.resolve(rawResult)
		.then(result => assertResult(adapter, result, expected, entry.normalize))
}

/** The operation itself, or a promise for it once every verification has settled. */
function operationAfter(verifications, operation) {
	const pending = verifications.filter(verification => verification !== undefined)
	return pending.length === 0
		? operation
		: Promise.all(pending)
				.then(() => operation)
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
	executionMode = 'sync',
	entry = 'native',
	createOperation,
}) {
	const mode = normalizeExecutionMode(id, executionMode)
	const group = benchmarkGroup(category, resultKind, issuePolicy, mode)
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
		executionMode: mode,
		entry,
		buildKey,
		steps: normalizeSteps(id, steps),
		support(adapter) {
			return supportFor(adapter, issuePolicy, requiredFeatures)
		},
		// Returns the operation, or a promise for it when an async scenario's
		// correctness check had to be awaited. The worker awaits either.
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
			return createOperation(
				adapter,
				{ issuePolicy, comparisonScope, resultKind, executionMode: mode, entry },
				resolveEntry(adapter, entry),
			)
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
		executionMode: options.executionMode,
		entry: options.entry,
		createOperation(adapter, context, entry) {
			const verifySchema = adapter.build[buildKey](context)
			const verification = verifyResult(adapter, entry, entry.call(verifySchema, correctnessInput, context), expected, context.executionMode)
			return operationAfter([verification], () => adapter.build[buildKey](context))
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
		executionMode: options.executionMode,
		entry: options.entry,
		createOperation(adapter, context, entry) {
			const operation = () => entry.call(adapter.build[buildKey](context), input, context)
			return operationAfter([verifyResult(adapter, entry, operation(), expected, context.executionMode)], operation)
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
		executionMode: options.executionMode,
		entry: options.entry,
		createOperation(adapter, context, entry) {
			const schema = adapter.build[buildKey](context)
			const operation = () => entry.call(schema, input, context)
			return operationAfter([verifyResult(adapter, entry, operation(), expected, context.executionMode)], operation)
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
		executionMode: options.executionMode,
		entry: options.entry,
		createOperation(adapter, context, entry) {
			const schema = adapter.build[buildKey](context)
			const verifications = inputs
				.map(input => verifyResult(adapter, entry, entry.call(schema, input, context), expected, context.executionMode))
			let index = 0
			const operation = () => {
				const input = inputs[index % inputs.length]
				index++
				return entry.call(schema, input, context)
			}
			return operationAfter(verifications, operation)
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
