import { describe, expect, it, vi } from 'vitest'
import { createValchecker, looseObject, object, strictObject, unknown } from '../index'
import { structuralFixture } from '../test-utils/fixtures'

const structuralFailureFixture = structuralFixture

const v = createValchecker({
	steps: [looseObject, object, strictObject, structuralFailureFixture, unknown],
}) as any

describe('structural internal-failure contracts', () => {
	it.each([
		['object', (struct: Record<string, any>) => v.object(struct)],
		['strictObject', (struct: Record<string, any>) => v.strictObject(struct)],
		['looseObject', (struct: Record<string, any>) => v.looseObject(struct)],
	] as const)('stops %s traversal after an internal child failure', (name, createSchema) => {
		const later = vi.fn()
		const schema = createSchema({
			internal: v.unknown()
				.internalFailure(),
			later: v.unknown()
				.observe(later),
		})
		const result = schema.execute({
			internal: 'value',
			later: 'not reached',
		})

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					path: ['internal'],
					payload: { method: 'internalFailure' },
				}],
			})
		expect((result as any).issues)
			.toHaveLength(1)
		expect(later, name).not.toHaveBeenCalled()
	})
})
