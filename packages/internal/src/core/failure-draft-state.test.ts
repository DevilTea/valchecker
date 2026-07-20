import type { AnyExecutionIssue, ExecutionFailureResult, ExecutionResult, StepPluginImpl, TStepPluginDef } from './types'
import { describe, expect, it, vi } from 'vitest'
import { object, string, unknown, use } from '../steps'
import { createValchecker, implStepPlugin, markFailureIssueDraftState } from './core'

const mutateFailurePlugin = implStepPlugin({
	appendDynamicIssue: ({ utils, params: [message] }: any) => {
		utils.addFailureStep((issues: AnyExecutionIssue[]) => {
			issues.push(utils.createIssue({
				code: 'test:appended_dynamic',
				payload: {},
				customMessage: message,
				defaultMessage: 'Unresolved appended issue.',
			}))
			return utils.failure(issues)
		})
	},
	replaceFailureIssue: ({ utils, params: [message] }: any) => {
		utils.addStep((result: ExecutionResult) => {
			if (utils.isFailure(result)) {
				result.issues[0] = utils.createIssue({
					code: 'test:replacement_dynamic',
					payload: {},
					customMessage: message,
					defaultMessage: 'Unresolved replacement issue.',
				})
			}
			return result
		})
	},
} as any) as StepPluginImpl<TStepPluginDef>

const v = createValchecker({ steps: [object, string, unknown, use] })
const mutableV = createValchecker({
	steps: [object, string, mutateFailurePlugin],
}) as any

function expectFailure(
	result: unknown,
): asserts result is ExecutionFailureResult<AnyExecutionIssue> {
	expect(result).toBeTypeOf('object')
	if (result == null || typeof result !== 'object' || !('issues' in result))
		throw new TypeError('Expected a failure result.')
}

describe('failure issue draft state', () => {
	it('keeps tracked static multi-issue failures unchanged and metadata non-enumerable', () => {
		const result = v.object({ first: v.string(), second: v.string() })
			.execute({ first: 1, second: 2 })
		expectFailure(result)

		expect(result.issues).toHaveLength(2)
		expect(Object.keys(result.issues)).toEqual(['0', '1'])
		expect(result.issues.map(issue => issue.message))
			.toEqual(['Expected a string.', 'Expected a string.'])
	})

	it('finalizes tracked dynamic multi-issue failures once', () => {
		const message = vi.fn((issue: AnyExecutionIssue) => `${issue.path.join('.')}:${issue.code}`)
		const result = v.object(
			{ first: v.string(), second: v.string() },
			{ message },
		).execute({ first: 1, second: 2 })
		expectFailure(result)

		expect(result.issues.map(issue => issue.message)).toEqual([
			'first:string:expected_string',
			'second:string:expected_string',
		])
		expect(message).toHaveBeenCalledTimes(2)
	})

	it('updates tracked draft state when the same issue array is reused', () => {
		const message = vi.fn((issue: AnyExecutionIssue) => `resolved:${issue.code}`)
		const child = v.string({ message })
		const first = child['~execute'](1)
		const second = child['~execute'](2)
		expectFailure(first)
		expectFailure(second)

		const issues = [first.issues[0], second.issues[0]]
		markFailureIssueDraftState(issues, false)
		markFailureIssueDraftState(issues, true)

		const external = {
			'~core': { operationMode: 'sync' as const },
			'~execute': () => ({ issues }),
		}
		const result = (v.unknown() as any).use(external).execute('value')
		expectFailure(result)

		expect(result.issues.map(issue => issue.message)).toEqual([
			'resolved:string:expected_string',
			'resolved:string:expected_string',
		])
		expect(message).toHaveBeenCalledTimes(2)
	})

	it('falls back to scanning untracked external multi-issue failures', () => {
		const message = vi.fn((issue: AnyExecutionIssue) => `${issue.path[0]}:${issue.code}`)
		const child = v.string({ message })
		const first = child['~execute'](1)
		const second = child['~execute'](2)
		expectFailure(first)
		expectFailure(second)

		const external = {
			'~core': { operationMode: 'sync' as const },
			'~execute': () => ({ issues: [first.issues[0], second.issues[0]] }),
		}
		const result = (v.unknown() as any).use(external).execute('value')
		expectFailure(result)

		expect(result.issues.map(issue => issue.message)).toEqual([
			'undefined:string:expected_string',
			'undefined:string:expected_string',
		])
		expect(message).toHaveBeenCalledTimes(2)
	})

	it('invalidates tracked state before failure-only steps mutate issues', () => {
		const message = vi.fn(() => 'Resolved appended issue.')
		const result = mutableV
			.object({ first: mutableV.string(), second: mutableV.string() })
			.appendDynamicIssue(message)
			.execute({ first: 1, second: 2 })
		expectFailure(result)

		expect(result.issues.map(issue => issue.message)).toEqual([
			'Expected a string.',
			'Expected a string.',
			'Resolved appended issue.',
		])
		expect(message).toHaveBeenCalledTimes(1)
	})

	it('invalidates tracked state before general steps replace issues', () => {
		const message = vi.fn(() => 'Resolved replacement issue.')
		const result = mutableV
			.object({ first: mutableV.string(), second: mutableV.string() })
			.replaceFailureIssue(message)
			.execute({ first: 1, second: 2 })
		expectFailure(result)

		expect(result.issues.map(issue => issue.message)).toEqual([
			'Resolved replacement issue.',
			'Expected a string.',
		])
		expect(message).toHaveBeenCalledTimes(1)
	})
})
