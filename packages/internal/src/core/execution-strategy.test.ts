import type { ExecutionIssue, ExecutionResult, StepPluginImpl, TStepPluginDef } from './types'
import { describe, expect, it } from 'vitest'
import { createValchecker, implStepPlugin } from './core'

const executionPlugin = implStepPlugin({
	syncPass: ({ utils }: any) => {
		utils.addStep((result: ExecutionResult) => result, 'sync')
	},
	maybePass: ({ utils, params: [asynchronous = false] }: any) => {
		utils.addStep((result: ExecutionResult) => asynchronous ? Promise.resolve(result) : result, 'maybe-async')
	},
	failSync: ({ utils }: any) => {
		utils.addSuccessStep((value: unknown) => utils.failure({
			code: 'test:failure',
			category: 'validation',
			payload: { value },
			message: 'Test failure.',
			path: [],
		} satisfies ExecutionIssue), 'sync')
	},
	asyncSuccessOnly: ({ utils }: any) => {
		utils.addSuccessStep(async (value: unknown) => utils.success(value), 'async')
	},
	asyncThrowSync: ({ utils }: any) => {
		utils.addStep(() => {
			throw new Error('synchronous async-step error')
		}, 'async')
	},
} as any) as StepPluginImpl<TStepPluginDef>

const v = createValchecker({ steps: [executionPlugin] }) as any

describe('operation-mode execution contracts', () => {
	it('keeps every synchronous execution entrypoint synchronous', () => {
		const schema = v.syncPass().syncPass()

		expect(schema['~core'].operationMode).toBe('sync')
		expect(schema['~execute']('value')).toEqual({ value: 'value' })
		expect(schema.execute('value')).toEqual({ value: 'value' })
		expect(schema['~standard'].validate('value')).toEqual({ value: 'value' })
	})

	it('keeps maybe-async execution adaptive to the actual result', async () => {
		const synchronous = v.maybePass(false)
		const asynchronous = v.maybePass(true)

		expect(synchronous['~core'].operationMode).toBe('maybe-async')
		expect(synchronous['~execute']('value')).toEqual({ value: 'value' })
		expect(synchronous.execute('value')).toEqual({ value: 'value' })
		expect(synchronous['~standard'].validate('value')).toEqual({ value: 'value' })

		const rawResult = asynchronous['~execute']('value')
		const publicResult = asynchronous.execute('value')
		const standardResult = asynchronous['~standard'].validate('value')

		expect(rawResult).toBeInstanceOf(Promise)
		expect(publicResult).toBeInstanceOf(Promise)
		expect(standardResult).toBeInstanceOf(Promise)
		await expect(rawResult).resolves.toEqual({ value: 'value' })
		await expect(publicResult).resolves.toEqual({ value: 'value' })
		await expect(standardResult).resolves.toEqual({ value: 'value' })
	})

	it('preserves the async Promise boundary when a success-only callback is skipped', async () => {
		const schema = v.failSync().asyncSuccessOnly()
		const rawResult = schema['~execute']('value')
		const publicResult = schema.execute('value')
		const standardResult = schema['~standard'].validate('value')

		expect(schema['~core'].operationMode).toBe('async')
		expect(rawResult).toBeInstanceOf(Promise)
		expect(publicResult).toBeInstanceOf(Promise)
		expect(standardResult).toBeInstanceOf(Promise)
		await expect(rawResult).resolves.toMatchObject({ issues: [{ code: 'test:failure' }] })
		await expect(publicResult).resolves.toMatchObject({ issues: [{ code: 'test:failure' }] })
		await expect(standardResult).resolves.toMatchObject({ issues: [{ code: 'test:failure' }] })
	})

	it('normalizes a synchronous throw from an async step without losing the Promise boundary', async () => {
		const result = v.asyncThrowSync().execute('value')

		expect(result).toBeInstanceOf(Promise)
		await expect(result).resolves.toMatchObject({
			issues: [{
				code: 'core:unknown_exception',
				category: 'internal',
				payload: {
					method: 'asyncThrowSync',
					error: expect.objectContaining({ message: 'synchronous async-step error' }),
				},
			}],
		})
	})
})
