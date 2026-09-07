// `issue-policy/*` for the structures that existed when the suite was written:
// each structure is measured twice on the same invalid input, once stopping at
// the first issue and once collecting them all, with the exact issue count
// asserted before timing.
import { issuePolicyPair } from './define.mjs'

const invalidCollectionValues = Array.from({ length: 100 }, (_, index) => `item-${index}`)
invalidCollectionValues[0] = 0
invalidCollectionValues[99] = 99

const invalidMapEntries = Array.from({ length: 100 }, (_, index) => [`item-${index}`, index])
invalidMapEntries[0] = [0, 0]
invalidMapEntries[99] = ['item-99', 'invalid']

const issuePolicySuccess = {
	object: Object.freeze({ first: 'one', second: 'two' }),
	strictObject: Object.freeze({ first: 'one', second: 'two' }),
	looseObject: Object.freeze({ first: 'one', second: 'two', extra: true }),
	array: Object.freeze(['one', 'two']),
	set: new Set(['one', 'two']),
	map: new Map([['one', 1], ['two', 2]]),
}

function exactSuccess(input) {
	return [{ input, expected: { success: true, output: input } }]
}

const issuePolicyInputs = {
	object: Object.freeze({ first: 1, second: 2 }),
	strictObject: Object.freeze({ first: 1, second: 2, extra: true }),
	looseObject: Object.freeze({ first: 1, second: 2, extra: true }),
	array: Object.freeze([...invalidCollectionValues]),
	set: new Set(invalidCollectionValues),
	map: new Map(invalidMapEntries),
	intersection: Object.freeze({ left: 1, right: 2 }),
}

export const issuePolicyScenarios = [
	...issuePolicyPair('object', 'issuePolicyObject', issuePolicyInputs.object, { conformanceCases: exactSuccess(issuePolicySuccess.object), tier: 'smoke', steps: ['object', 'string'] }),
	...issuePolicyPair('strict-object', 'issuePolicyStrictObject', issuePolicyInputs.strictObject, { conformanceCases: exactSuccess(issuePolicySuccess.strictObject), allIssueCount: 3, steps: ['strictObject', 'string'] }),
	...issuePolicyPair('loose-object', 'issuePolicyLooseObject', issuePolicyInputs.looseObject, { comparisonScope: 'compatible-subset', comparisonNote: 'On successful passthrough Valchecker emits undeclared keys before declared keys, while the competitors preserve first/second/extra enumeration order. The timed failure fixtures still agree on the compared issue-count behavior.', steps: ['looseObject', 'string'] }),
	...issuePolicyPair('array', 'issuePolicyArray', issuePolicyInputs.array, { conformanceCases: exactSuccess(issuePolicySuccess.array), steps: ['array', 'string'] }),
	...issuePolicyPair('set', 'issuePolicySet', issuePolicyInputs.set, { conformanceCases: exactSuccess(issuePolicySuccess.set), steps: ['set', 'string'] }),
	...issuePolicyPair('map', 'issuePolicyMap', issuePolicyInputs.map, { conformanceCases: exactSuccess(issuePolicySuccess.map), steps: ['map', 'string', 'number'] }),
	...issuePolicyPair('intersection', 'issuePolicyIntersection', issuePolicyInputs.intersection, { comparisonScope: 'compatible-subset', steps: ['intersection', 'object', 'string'] }),
]
