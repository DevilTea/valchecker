// `issue-policy/record/*` and `issue-policy/tuple/*`. These sit apart from
// `issue-policy.mjs` because they were added after it in the report order, and
// existing scenario order is kept byte-for-byte stable.
import { issuePolicyPair } from './define.mjs'

const issuePolicyRecordInput = Object.freeze({
	first: 'invalid',
	second: 'invalid',
})

const issuePolicyTupleInput = Object.freeze([0, 1])

export const issuePolicyRecordTupleScenarios = [
	...issuePolicyPair('record', 'issuePolicyRecord', issuePolicyRecordInput, { comparisonScope: 'compatible-subset', steps: ['record', 'string', 'number'] }),
	...issuePolicyPair('tuple', 'issuePolicyTuple', issuePolicyTupleInput, { comparisonScope: 'compatible-subset', steps: ['tuple', 'string'] }),
]
