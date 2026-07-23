import {
	collectionStructures,
	createInvalidRecords,
	createRecords,
	flatObject,
	flatObjectPool,
	issuePolicyInputs,
	nestedObject,
	optionalHeavy,
	optionalSparsePool,
	primitive,
	recordArrayPool,
	transformInputs,
	unionFirstPool,
	unionInputs,
} from './fixtures.mjs'

const tierRank = { smoke: 0, standard: 1, full: 2 }
const explicitIssuePolicies = new Set(['first', 'all'])

function canonicalizeOutput(value) {
	if (value instanceof Map)
		return { type: 'Map', entries: [...value].map(([key, item]) => [canonicalizeOutput(key), canonicalizeOutput(item)]) }
	if (value instanceof Set)
		return { type: 'Set', values: [...value].map(canonicalizeOutput) }
	if (Array.isArray(value))
		return value.map(canonicalizeOutput)
	if (value != null && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value)
			.map(([key, item]) => [key, canonicalizeOutput(item)]))
	}
	return value
}

function assertResult(adapter, rawResult, expected) {
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

function benchmarkGroup(category, resultKind, issuePolicy) {
	if (category !== 'warm')
		return category
	if (resultKind === 'success')
		return 'warm/success'
	return `warm/failure/${issuePolicy}`
}

function supportFor(adapter, issuePolicy) {
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

function defineScenario({
	id,
	category,
	tier,
	buildKey,
	resultKind,
	issuePolicy,
	comparisonScope,
	diagnosticIssueCount,
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
		buildKey,
		support(adapter) {
			return supportFor(adapter, issuePolicy)
		},
		setup(adapter) {
			return createOperation(adapter, { issuePolicy, comparisonScope, resultKind })
		},
	}
}

function construction(id, tier, buildKey, correctnessInput, expected = { success: true }, options = {}) {
	return defineScenario({
		id,
		category: 'construction',
		tier,
		buildKey,
		resultKind: expected.success ? 'success' : 'failure',
		issuePolicy: options.issuePolicy ?? 'not-applicable',
		comparisonScope: options.comparisonScope ?? 'equivalent',
		diagnosticIssueCount: expected.issueCount ?? null,
		createOperation(adapter, context) {
			const verifySchema = adapter.build[buildKey](context)
			assertResult(adapter, adapter.parse(verifySchema, correctnessInput, context), expected)
			return () => adapter.build[buildKey](context)
		},
	})
}

function cold(id, tier, buildKey, input, expected, options = {}) {
	return defineScenario({
		id,
		category: 'cold',
		tier,
		buildKey,
		resultKind: expected.success ? 'success' : 'failure',
		issuePolicy: options.issuePolicy ?? (expected.success ? 'not-applicable' : 'library-default'),
		comparisonScope: options.comparisonScope ?? (expected.success ? 'equivalent' : 'library-defaults'),
		diagnosticIssueCount: expected.issueCount ?? null,
		createOperation(adapter, context) {
			const operation = () => adapter.parse(adapter.build[buildKey](context), input, context)
			assertResult(adapter, operation(), expected)
			return operation
		},
	})
}

function warm(id, tier, buildKey, input, expected, options = {}) {
	return defineScenario({
		id,
		category: 'warm',
		tier,
		buildKey,
		resultKind: expected.success ? 'success' : 'failure',
		issuePolicy: options.issuePolicy ?? (expected.success ? 'not-applicable' : 'library-default'),
		comparisonScope: options.comparisonScope ?? (expected.success ? 'equivalent' : 'library-defaults'),
		diagnosticIssueCount: expected.issueCount ?? null,
		createOperation(adapter, context) {
			const schema = adapter.build[buildKey](context)
			const operation = () => adapter.parse(schema, input, context)
			assertResult(adapter, operation(), expected)
			return operation
		},
	})
}

function warmPool(id, tier, buildKey, inputs, expected, options = {}) {
	return defineScenario({
		id,
		category: 'warm',
		tier,
		buildKey,
		resultKind: expected.success ? 'success' : 'failure',
		issuePolicy: options.issuePolicy ?? (expected.success ? 'not-applicable' : 'library-default'),
		comparisonScope: options.comparisonScope ?? (expected.success ? 'equivalent' : 'library-defaults'),
		diagnosticIssueCount: expected.issueCount ?? null,
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

function issuePolicyPair(structure, buildKey, input, options = {}) {
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
			{ issuePolicy: 'first', comparisonScope },
		),
		warm(
			`issue-policy/${structure}/invalid/all`,
			tier,
			buildKey,
			input,
			{ success: false, issueCount: allIssueCount },
			{ issuePolicy: 'all', comparisonScope },
		),
	]
}

const records10 = createRecords(10)
const records100 = createRecords(100)
const records1000 = createRecords(1000)

const allScenarios = [
	construction('construct/primitive', 'smoke', 'primitive', primitive.valid),
	construction('construct/flat-object', 'standard', 'flatObject', flatObject.valid),
	construction('construct/nested-object', 'standard', 'nestedObject', nestedObject.valid),
	construction('construct/union', 'standard', 'union', unionInputs.first),
	construction('construct/set', 'standard', 'set', collectionStructures.set100, { success: true, output: collectionStructures.set100 }),
	construction('construct/map', 'standard', 'map', collectionStructures.map100, { success: true, output: collectionStructures.map100 }),
	construction('construct/intersection', 'standard', 'intersection', collectionStructures.intersection, { success: true, output: collectionStructures.intersection }, { comparisonScope: 'compatible-subset' }),

	cold('cold/flat-valid', 'smoke', 'flatObject', flatObject.valid, { success: true }),
	cold('cold/nested-valid', 'standard', 'nestedObject', nestedObject.valid, { success: true }),
	cold('cold/union-last', 'standard', 'union', unionInputs.last, { success: true }),
	cold('cold/set-valid', 'standard', 'set', collectionStructures.set100, { success: true, output: collectionStructures.set100 }),
	cold('cold/map-valid', 'standard', 'map', collectionStructures.map100, { success: true, output: collectionStructures.map100 }),
	cold('cold/intersection-valid', 'standard', 'intersection', collectionStructures.intersection, { success: true, output: collectionStructures.intersection }, { comparisonScope: 'compatible-subset' }),

	warm('primitive/valid', 'smoke', 'primitive', primitive.valid, { success: true }),
	warm('primitive/invalid-type', 'standard', 'primitive', primitive.invalidEarly, { success: false }),
	warm('primitive/invalid-late', 'standard', 'primitive', primitive.invalidLate, { success: false }),

	warm('flat-object/valid', 'smoke', 'flatObject', flatObject.valid, { success: true }),
	warmPool('flat-object/valid-rotating', 'standard', 'flatObject', flatObjectPool, { success: true }),
	warm('flat-object/invalid-first', 'standard', 'flatObject', flatObject.invalidFirst, { success: false }),
	warm('flat-object/invalid-last', 'standard', 'flatObject', flatObject.invalidLast, { success: false }),
	warm('flat-object/strict-extra', 'standard', 'strictFlatObject', flatObject.extra, { success: false }),

	warm('nested-object/valid', 'standard', 'nestedObject', nestedObject.valid, { success: true }),
	warm('nested-object/invalid-deep', 'standard', 'nestedObject', nestedObject.invalidDeep, { success: false }),

	warm('array/10-valid', 'smoke', 'recordArray', records10, { success: true }),
	warmPool('array/10-valid-rotating', 'standard', 'recordArray', recordArrayPool, { success: true }),
	warm('array/100-valid', 'standard', 'recordArray', records100, { success: true }),
	warm('array/1000-valid', 'full', 'recordArray', records1000, { success: true }),
	warm('array/100-invalid-first', 'standard', 'recordArray', createInvalidRecords(100, 0), { success: false }),
	warm('array/100-invalid-last', 'standard', 'recordArray', createInvalidRecords(100, 99), { success: false }),
	warm('array/1000-invalid-last', 'full', 'recordArray', createInvalidRecords(1000, 999), { success: false }),

	warm('set/100-valid', 'standard', 'set', collectionStructures.set100, { success: true, output: collectionStructures.set100 }),
	warm('map/100-valid', 'standard', 'map', collectionStructures.map100, { success: true, output: collectionStructures.map100 }),
	warm('intersection/valid', 'standard', 'intersection', collectionStructures.intersection, { success: true, output: collectionStructures.intersection }, { comparisonScope: 'compatible-subset' }),

	warm('union/first', 'smoke', 'union', unionInputs.first, { success: true }),
	warmPool('union/first-rotating', 'standard', 'union', unionFirstPool, { success: true }),
	warm('union/middle', 'standard', 'union', unionInputs.middle, { success: true }),
	warm('union/last', 'standard', 'union', unionInputs.last, { success: true }),
	warm('union/all-fail', 'standard', 'union', unionInputs.invalid, { success: false }),

	warm('transform/valid', 'smoke', 'transform', transformInputs.valid, {
		success: true,
		output: transformInputs.output,
	}),
	warm('transform/invalid-type', 'standard', 'transform', transformInputs.invalid, { success: false }),

	warm('optional-heavy/sparse', 'standard', 'optionalHeavy', optionalHeavy.sparse, { success: true }),
	warmPool('optional-heavy/sparse-rotating', 'standard', 'optionalHeavy', optionalSparsePool, { success: true }),
	warm('optional-heavy/full', 'standard', 'optionalHeavy', optionalHeavy.full, { success: true }),
	warm('optional-heavy/invalid', 'standard', 'optionalHeavy', optionalHeavy.invalid, { success: false }),

	...issuePolicyPair('object', 'issuePolicyObject', issuePolicyInputs.object, { tier: 'smoke' }),
	...issuePolicyPair('strict-object', 'issuePolicyStrictObject', issuePolicyInputs.strictObject, { allIssueCount: 3 }),
	...issuePolicyPair('loose-object', 'issuePolicyLooseObject', issuePolicyInputs.looseObject),
	...issuePolicyPair('array', 'issuePolicyArray', issuePolicyInputs.array),
	...issuePolicyPair('set', 'issuePolicySet', issuePolicyInputs.set),
	...issuePolicyPair('map', 'issuePolicyMap', issuePolicyInputs.map),
	...issuePolicyPair('intersection', 'issuePolicyIntersection', issuePolicyInputs.intersection, { comparisonScope: 'compatible-subset' }),
]

export function getScenarios(mode) {
	const rank = tierRank[mode]
	if (rank === undefined)
		throw new Error(`Unknown benchmark mode: ${mode}`)
	return allScenarios.filter(scenario => tierRank[scenario.tier] <= rank)
}

export function getScenarioCatalog(mode) {
	return getScenarios(mode)
		.map(scenario => ({
			id: scenario.id,
			category: scenario.category,
			tier: scenario.tier,
			group: scenario.group,
			resultKind: scenario.resultKind,
			issuePolicy: scenario.issuePolicy,
			comparisonScope: scenario.comparisonScope,
			diagnosticIssueCount: scenario.diagnosticIssueCount,
		}))
}
