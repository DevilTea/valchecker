import { describe, expect, it, vi } from 'vitest'
import { implStepPlugin } from '../core'
import { createValchecker, looseObject, strictObject, unknown } from '../..'

const structuralFailureFixture = implStepPlugin<any>({
	internalFailure: ({ utils }: any) => {
		utils.addSuccessStep(() => {
			throw new Error('internal failure')
		})
	},
	observe: ({ utils, params: [callback] }: any) => {
		utils.addSuccessStep((value: unknown) => {
			callback(value)
			return utils.success(value)
		})
	},
})

const v = createValchecker({
	steps: [looseObject, strictObject, structuralFailureFixture, unknown],
}) as any

describe('structural internal-failure contracts', () => {
	it.each([
		['strictObject', (struct: Record<string, any>) => v.strictObject(struct)],
		['looseObject', (struct: Record<string, any>) => v.looseObject(struct)],
	] as const)('stops %s traversal after an internal child failure', (name, createSchema) => {
		const later = vi.fn()
		const schema = createSchema({
			internal: v.unknown().internalFailure(),
			later: v.unknown().observe(later),
		})
		const result = schema.execute({
			internal: 'value',
			later: 'not reached',
		})

		expect(result).toMatchObject({
			issues: [{
				code: 'core:unknown_exception',
				category: 'internal',
				path: ['internal'],
				payload: { method: 'internalFailure' },
			}],
		})
		expect((result as any).issues).toHaveLength(1)
		expect(later, name).not.toHaveBeenCalled()
	})
})
