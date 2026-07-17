import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, TStepPluginDef } from '../../core'
import { describe, expect, it, vi } from 'vitest'
import { createValchecker, fallback, implStepPlugin, number, string, union } from '../..'

type FatalIssue = ExecutionIssue<'fatal:failed', { value: unknown }, 'internal'>
type FatalMeta = DefineStepMethodMeta<{
	Name: 'fatal'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: FatalIssue
}>
interface FatalPluginDef extends TStepPluginDef {
	fatal: DefineStepMethod<
		FatalMeta,
		this['CurrentValchecker'] extends FatalMeta['ExpectedCurrentValchecker']
			? () => Next<{ issue: FatalIssue }, this['CurrentValchecker']>
			: never
	>
}
const fatal = implStepPlugin<FatalPluginDef>({
	fatal: ({ utils: { addSuccessStep, createIssue, failure } }) => {
		addSuccessStep(value => failure(createIssue({
			code: 'fatal:failed',
			category: 'internal',
			payload: { value },
			defaultMessage: 'Fatal failure.',
		})))
	},
})

const v = createValchecker({ steps: [fallback, string, number, union, fatal] })

function expectedNumberIssue(value: unknown) {
	return {
		code: 'number:expected_number',
		category: 'validation',
		message: 'Expected a number.',
		path: [],
		payload: { value },
	}
}

describe('fallback plugin', () => {
	it('does not run when the previous step succeeds', () => {
		expect(v.string().fallback(() => 'fallback').execute('hello'))
			.toEqual({ value: 'hello' })
	})

	it('recovers validation failures and passes the original issues', () => {
		let captured: unknown
		const result = v.number()
			.fallback((issues) => {
				captured = issues
				return 42
			})
			.execute('bad')
		expect(result).toEqual({ value: 42 })
		expect(captured).toEqual([expectedNumberIssue('bad')])
	})

	it('supports asynchronous recovery', async () => {
		await expect(v.number().fallback(async () => 42).execute('bad'))
			.resolves.toEqual({ value: 42 })
	})

	it('bypasses the callback for internal failures', () => {
		const run = vi.fn(() => 'recovered')
		const result = v.fatal().fallback(run).execute('input')
		expect(run).not.toHaveBeenCalled()
		expect(result).toEqual({
			issues: [{
				code: 'fatal:failed',
				category: 'internal',
				message: 'Fatal failure.',
				path: [],
				payload: { value: 'input' },
			}],
		})
	})

	it('preserves original issues when the callback throws', () => {
		const error = new Error('Fallback error')
		const original = expectedNumberIssue('bad')
		const result = v.number()
			.fallback(() => { throw error })
			.execute('bad')
		expect(result).toEqual({
			issues: [
				original,
				{
					code: 'fallback:failed',
					category: 'operation',
					message: 'Fallback failed.',
					path: [],
					payload: { receivedIssues: [original], error },
				},
			],
		})
	})

	it('preserves original issues when the callback rejects', async () => {
		const error = new Error('Rejected fallback error')
		const original = expectedNumberIssue('bad')
		await expect(v.number()
			.fallback(async () => { throw error })
			.execute('bad'))
			.resolves.toEqual({
				issues: [
					original,
					{
						code: 'fallback:failed',
						category: 'operation',
						message: 'Fallback failed.',
						path: [],
						payload: { receivedIssues: [original], error },
					},
				],
			})
	})

	it('isolates callback mutations from preserved original issues', () => {
		const error = new Error('Mutating fallback error')
		const original = expectedNumberIssue('bad')
		const result = v.number()
			.fallback((issues) => {
				issues[0].path.push('mutated')
				issues.splice(0, issues.length)
				throw error
			})
			.execute('bad')
		expect(result).toEqual({
			issues: [
				original,
				{
					code: 'fallback:failed',
					category: 'operation',
					message: 'Fallback failed.',
					path: [],
					payload: { receivedIssues: [original], error },
				},
			],
		})
	})

	it('stores public-safe snapshots of the issues received by the callback', () => {
		const result = v.number(() => 'Dynamic number issue')
			.fallback(() => { throw new Error('failure') })
			.execute('bad')
		expect(result).toMatchObject({
			issues: [
				{ code: 'number:expected_number', message: 'Dynamic number issue' },
				{ code: 'fallback:failed' },
			],
		})
		if (v.isFailure(result)) {
			const callbackIssue = result.issues[1]
			if (callbackIssue?.code === 'fallback:failed') {
				const snapshot = callbackIssue.payload.receivedIssues[0]!
				expect(Object.getOwnPropertySymbols(snapshot)).toEqual([])
				expect(snapshot.path).not.toBe(result.issues[0]!.path)
			}
		}
	})

	it('snapshots union provenance received by a failing callback', () => {
		const result = v.union([v.string(), v.number()])
			.fallback(() => { throw new Error('failure') })
			.execute(false)
		if (!v.isFailure(result))
			throw new Error('Expected failure')
		const callbackIssue = result.issues[2]
		if (callbackIssue?.code !== 'fallback:failed')
			throw new Error('Expected fallback issue')
		const snapshot = callbackIssue.payload.receivedIssues[0]!
		expect(snapshot.context).toEqual([{ type: 'union', branchIndex: 0 }])
		expect(snapshot.context).not.toBe(result.issues[0]!.context)
	})

	it('uses the callback failure message override', () => {
		const original = expectedNumberIssue('bad')
		const result = v.number()
			.fallback(() => { throw new Error('failure') }, 'Custom fallback message')
			.execute('bad')
		expect(result).toMatchObject({
			issues: [
				original,
				{
					code: 'fallback:failed',
					category: 'operation',
					message: 'Custom fallback message',
				},
			],
		})
	})
})
