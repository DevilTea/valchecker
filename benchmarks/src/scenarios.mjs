import {
	createInvalidRecords,
	createRecords,
	flatObject,
	flatObjectPool,
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

function assertResult(adapter, rawResult, expected) {
	const normalized = adapter.normalize(rawResult)
	if (normalized.success !== expected.success)
		throw new Error(`${adapter.name}: expected success=${expected.success}, received ${normalized.success}`)

	if (expected.output !== undefined) {
		const actual = JSON.stringify(normalized.output)
		const wanted = JSON.stringify(expected.output)
		if (actual !== wanted)
			throw new Error(`${adapter.name}: output mismatch. Expected ${wanted}, received ${actual}`)
	}
}

function construction(id, tier, buildKey, correctnessInput, expected = { success: true }) {
	return {
		id,
		category: 'construction',
		tier,
		setup(adapter) {
			const verifySchema = adapter.build[buildKey]()
			assertResult(adapter, adapter.parse(verifySchema, correctnessInput), expected)
			return () => adapter.build[buildKey]()
		},
	}
}

function cold(id, tier, buildKey, input, expected) {
	return {
		id,
		category: 'cold',
		tier,
		setup(adapter) {
			const operation = () => adapter.parse(adapter.build[buildKey](), input)
			assertResult(adapter, operation(), expected)
			return operation
		},
	}
}

function warm(id, tier, buildKey, input, expected) {
	return {
		id,
		category: 'warm',
		tier,
		setup(adapter) {
			const schema = adapter.build[buildKey]()
			const operation = () => adapter.parse(schema, input)
			assertResult(adapter, operation(), expected)
			return operation
		},
	}
}

function warmPool(id, tier, buildKey, inputs, expected) {
	return {
		id,
		category: 'warm',
		tier,
		setup(adapter) {
			const schema = adapter.build[buildKey]()
			for (const input of inputs)
				assertResult(adapter, adapter.parse(schema, input), expected)
			let index = 0
			return () => {
				const input = inputs[index % inputs.length]
				index++
				return adapter.parse(schema, input)
			}
		},
	}
}

const records10 = createRecords(10)
const records100 = createRecords(100)
const records1000 = createRecords(1000)

const allScenarios = [
	construction('construct/primitive', 'smoke', 'primitive', primitive.valid),
	construction('construct/flat-object', 'standard', 'flatObject', flatObject.valid),
	construction('construct/nested-object', 'standard', 'nestedObject', nestedObject.valid),
	construction('construct/union', 'standard', 'union', unionInputs.first),

	cold('cold/flat-valid', 'smoke', 'flatObject', flatObject.valid, { success: true }),
	cold('cold/nested-valid', 'standard', 'nestedObject', nestedObject.valid, { success: true }),
	cold('cold/union-last', 'standard', 'union', unionInputs.last, { success: true }),

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
]

export function getScenarios(mode) {
	const rank = tierRank[mode]
	if (rank === undefined)
		throw new Error(`Unknown benchmark mode: ${mode}`)
	return allScenarios.filter(scenario => tierRank[scenario.tier] <= rank)
}
