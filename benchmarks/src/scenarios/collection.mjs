// Warmed `array/*`, `set/*`, `map/*`, and `intersection/*` cases. Intersection
// is not a collection, but it shares this block in the report with `set` and
// `map`, and keeping the three together preserves that order.
import { collectionStructures } from '../fixtures.mjs'
import { warm, warmPool } from './define.mjs'

function createRecords(length, offset = 0) {
	return Array.from({ length }, (_, index) => ({
		id: `item-${offset + index}`,
		value: offset + index,
		enabled: (offset + index) % 2 === 0,
	}))
}

function createInvalidRecords(length, invalidIndex) {
	const records = createRecords(length)
	records[invalidIndex] = {
		id: `item-${invalidIndex}`,
		value: 'invalid',
		enabled: true,
	}
	return records
}

const recordArrayPool = Array.from({ length: 32 }, (_, index) => createRecords(10, index * 10))

const records10 = createRecords(10)
const records100 = createRecords(100)
const records1000 = createRecords(1000)

const recordArraySteps = ['array', 'object', 'string', 'number', 'boolean']
const setSteps = ['set', 'string']
const mapSteps = ['map', 'string', 'number']
const intersectionSteps = ['intersection', 'object', 'string', 'number']

export const collectionScenarios = [
	warm('array/10-valid', 'smoke', 'recordArray', records10, { success: true, output: records10 }, { steps: recordArraySteps }),
	warmPool('array/10-valid-rotating', 'standard', 'recordArray', recordArrayPool, { success: true }, { steps: recordArraySteps }),
	warm('array/100-valid', 'standard', 'recordArray', records100, { success: true }, { steps: recordArraySteps }),
	warm('array/1000-valid', 'full', 'recordArray', records1000, { success: true }, { steps: recordArraySteps }),
	warm('array/100-invalid-first', 'standard', 'recordArray', createInvalidRecords(100, 0), { success: false }, { steps: recordArraySteps }),
	warm('array/100-invalid-last', 'standard', 'recordArray', createInvalidRecords(100, 99), { success: false }, { steps: recordArraySteps }),
	warm('array/1000-invalid-last', 'full', 'recordArray', createInvalidRecords(1000, 999), { success: false }, { steps: recordArraySteps }),

	warm('set/100-valid', 'standard', 'set', collectionStructures.set100, { success: true, output: collectionStructures.set100 }, { conformanceCases: [{ input: new Set([1]), expected: { success: false } }], steps: setSteps }),
	warm('map/100-valid', 'standard', 'map', collectionStructures.map100, { success: true, output: collectionStructures.map100 }, { conformanceCases: [{ input: new Map([[1, 'invalid']]), expected: { success: false } }], steps: mapSteps }),
	warm('intersection/valid', 'standard', 'intersection', collectionStructures.intersection, { success: true, output: collectionStructures.intersection }, { comparisonScope: 'compatible-subset', steps: intersectionSteps }),
]
