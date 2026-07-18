import { describe, expect, it, vi } from 'vitest'
import { createValchecker, string, transform } from '../..'

const v = createValchecker({ steps: [string, transform] })

describe('transform step plugin', () => {
	it('returns a synchronous transformed output', () => {
		expect(v.string()
			.transform(value => value.toUpperCase())
			.execute('hello'))
			.toEqual({ value: 'HELLO' })
	})

	it('returns a native Promise for an asynchronous transformed output', async () => {
		const result = v.string()
			.transform(async value => value.toUpperCase())
			.execute('hello')

		expect(result)
			.toBeInstanceOf(Promise)
		await expect(result).resolves.toEqual({ value: 'HELLO' })
	})

	it('reports the complete synchronous callback failure contract', () => {
		const error = new Error('sync error')
		expect(v.string()
			.transform(() => { throw error })
			.execute('hello'))
			.toEqual({
				issues: [{
					code: 'transform:callback_failed',
					category: 'operation',
					message: 'Transform callback failed.',
					path: [],
					payload: { phase: 'throw', value: 'hello', error },
				}],
			})
	})

	it('distinguishes asynchronous callback rejection in the payload', async () => {
		const error = new Error('async error')
		await expect(v.string()
			.transform(async () => { throw error })
			.execute('hello')).resolves.toEqual({
			issues: [{
				code: 'transform:callback_failed',
				category: 'operation',
				message: 'Transform callback failed.',
				path: [],
				payload: { phase: 'reject', value: 'hello', error },
			}],
		})
	})

	it('uses a custom message for callback failures', () => {
		expect(v.string()
			.transform(() => { throw new Error('error') }, { message: issue => `Custom: ${(issue.payload.error as Error).message}` },
			)
			.execute('hello'))
			.toMatchObject({
				issues: [{
					code: 'transform:callback_failed',
					message: 'Custom: error',
				}],
			})
	})

	it('does not invoke the callback after an earlier failure', () => {
		const callback = vi.fn((value: string) => value)
		expect(v.string()
			.transform(callback)
			.execute(42))
			.toMatchObject({
				issues: [{ code: 'string:expected_string' }],
			})
		expect(callback).not.toHaveBeenCalled()
	})
})
