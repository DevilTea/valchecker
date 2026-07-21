import { describe, expect, it, vi } from 'vitest'
import { implStepPlugin } from '../../core'
import { createValchecker, number, object, string, transform, unknown } from '../..'

const fixture = implStepPlugin<any>({
	internalFailure: ({ utils }: any) => {
		utils.addSuccessStep(() => {
			throw new Error('internal failure')
		})
	},
	asyncInternalFailure: ({ utils }: any) => {
		utils.addSuccessStep(async () => {
			throw new Error('async internal failure')
		})
	},
	observe: ({ utils, params: [callback] }: any) => {
		utils.addSuccessStep((value: unknown) => {
			callback(value)
			return utils.success(value)
		})
	},
})

const v = createValchecker({ steps: [fixture, number, object, string, transform, unknown] })

describe('object collectAllIssues', () => {
	it('retains object classification before field traversal', () => {
		expect(v.object({}, { collectAllIssues: true }).execute([]))
			.toMatchObject({ issues: [{ code: 'object:expected_object' }] })
	})

	it('materializes optional and safe __proto__ fields', () => {
		const ignored = Symbol('ignored')
		const shape: Record<PropertyKey, any> = {
			required: v.string(),
			optional: [v.number()],
		}
		Object.defineProperty(shape, '__proto__', { enumerable: true, value: v.string() })
		Object.defineProperty(shape, ignored, { enumerable: false, value: v.string() })
		const input: Record<PropertyKey, unknown> = { required: 'ok' }
		Object.defineProperty(input, '__proto__', { enumerable: true, value: 'safe' })

		const result = v.object(shape, { collectAllIssues: true }).execute(input)
		expect(result).toMatchObject({ value: { required: 'ok', optional: undefined } })
		expect(Object.hasOwn((result as any).value, '__proto__')).toBe(true)
		expect((result as any).value.__proto__).toBe('safe')
	})

	it('collects missing and invalid fields before a synchronous internal issue', () => {
		const later = vi.fn()
		const result = (v as any).object({
			missing: v.string(),
			invalid: v.number(),
			internal: (v as any).unknown().internalFailure(),
			later: (v as any).unknown().observe(later),
		}, { collectAllIssues: true }).execute({ invalid: 'bad', internal: 'value', later: 'later' })

		expect(result).toMatchObject({ issues: [
			{ code: 'object:missing_key', path: ['missing'] },
			{ code: 'number:expected_number', path: ['invalid'] },
			{ code: 'core:unknown_exception', path: ['internal'] },
		] })
		expect(later).not.toHaveBeenCalled()
	})

	it('continues after an asynchronous recoverable issue and stops after an internal issue', async () => {
		await expect(v.object({
			first: v.string().transform(async () => {
				throw new Error('recoverable')
			}),
			optional: [v.number()],
			last: v.string().transform(value => value.toUpperCase()),
			missing: v.string(),
		}, { collectAllIssues: true }).execute({ first: 'bad', last: 'ok' }))
			.resolves.toMatchObject({ issues: [
				{ code: 'transform:callback_failed', path: ['first'] },
				{ code: 'object:missing_key', path: ['missing'] },
			] })

		const later = vi.fn()
		await expect((v as any).object({
			first: (v as any).unknown().asyncInternalFailure(),
			later: (v as any).unknown().observe(later),
		}, { collectAllIssues: true }).execute({ first: 'bad', later: 'later' }))
			.resolves.toMatchObject({ issues: [{ code: 'core:unknown_exception', path: ['first'] }] })
		expect(later).not.toHaveBeenCalled()
	})
})
