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
	...issuePolicyPair('object', 'issuePolicyObject', issuePolicyInputs.object, { tier: 'smoke', steps: ['object', 'string'] }),
	...issuePolicyPair('strict-object', 'issuePolicyStrictObject', issuePolicyInputs.strictObject, { allIssueCount: 3, steps: ['strictObject', 'string'] }),
	...issuePolicyPair('loose-object', 'issuePolicyLooseObject', issuePolicyInputs.looseObject, { steps: ['looseObject', 'string'] }),
	...issuePolicyPair('array', 'issuePolicyArray', issuePolicyInputs.array, { steps: ['array', 'string'] }),
	...issuePolicyPair('set', 'issuePolicySet', issuePolicyInputs.set, { steps: ['set', 'string'] }),
	...issuePolicyPair('map', 'issuePolicyMap', issuePolicyInputs.map, { steps: ['map', 'string', 'number'] }),
	...issuePolicyPair('intersection', 'issuePolicyIntersection', issuePolicyInputs.intersection, { comparisonScope: 'compatible-subset', steps: ['intersection', 'object', 'string'] }),
]
