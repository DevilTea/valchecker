import { describe, expect, it, vi } from 'vitest'
import { implStepPlugin } from '../../core'
import { createValchecker, set, string, transform, unknown } from '../..'

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

const v = createValchecker({ steps: [fixture, set, string, transform, unknown] })

describe('set collectAllIssues', () => {
	it('retains Set classification before item traversal', () => {
		expect(v.set(v.string(), { collectAllIssues: true }).execute([]))
			.toMatchObject({ issues: [{ code: 'set:expected_set' }] })
	})

	it('reports transformed-item collisions and continues later items', async () => {
		let first = true
		const item = v.string().transform((value) => {
			const transformed = value.toLowerCase()
			if (first) {
				first = false
				return Promise.resolve(transformed)
			}
			return transformed
		})

		const result = await v.set(item, { collectAllIssues: true })
			.execute(new Set(['A', 'a', 'B']))
		expect(result).toMatchObject({
			issues: [{ code: 'set:duplicate_transformed_item', path: [1] }],
		})
	})

	it('stops later items after synchronous and asynchronous internal issues', async () => {
		for (const internal of [
			(v as any).unknown().internalFailure(),
			(v as any).unknown().asyncInternalFailure(),
		]) {
			const later = vi.fn()
			const observed = (v as any).unknown().observe(later)
			const item = {
				'~execute': (value: unknown) => value === 'internal'
					? internal['~execute'](value)
					: observed['~execute'](value),
			} as any

			const result = await (v as any).set(item, { collectAllIssues: true })
				.execute(new Set(['internal', 'later']))
			expect(result).toMatchObject({ issues: [{ code: 'core:unknown_exception' }] })
			expect(later).not.toHaveBeenCalled()
		}
	})
})
