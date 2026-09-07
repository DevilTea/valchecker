import { describe, expect, it } from 'vitest'
import { declaredIssueCodes, issueCodeProblems } from './issue-code-analysis'

describe('issue-code declaration parsing', () => {
	it('reads every single- and double-quoted union member', () => {
		expect(declaredIssueCodes(`
		type First = ExecutionIssue<'first:bad_value' | "first:another_value", unknown>
		type Second = ExecutionIssue<"second:bad_value", unknown>
	`))
			.toEqual(['first:bad_value', 'first:another_value', 'second:bad_value'])
	})

	it('rejects an invalid later union member instead of checking only the first', () => {
		expect(issueCodeProblems('first', 'type Issue = ExecutionIssue<\'first:good_value\' | "other:bad_value", unknown>\n', 'fixture.ts'))
			.toContain('fixture.ts: issue code \'other:bad_value\' must be prefixed with \'first\'')
	})
})
