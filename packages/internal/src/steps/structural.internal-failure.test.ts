import { describe, expect, it, vi } from 'vitest'
import { createValchecker, isOneOf, looseObject, object, record, strictObject, unknown } from '../index'
import { structuralFixture } from '../test-utils/fixtures'

const structuralFailureFixture = structuralFixture

const v = createValchecker({
	steps: [isOneOf, looseObject, object, record, strictObject, structuralFailureFixture, unknown],
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

	// `record` shares one value schema across every entry, so a per-entry spy in front
	// of the failure is what shows how far traversal got. Collection is deliberately
	// enabled: with it off every failure stops traversal anyway, so only this setting
	// distinguishes internal fatality from ordinary short-circuiting. Both key domains
	// are covered because each drives its own traversal loop.
	it.each([
		['open', () => v.unknown()],
		['finite', () => v.isOneOf(['first', 'second'])],
	] as const)('stops record traversal with a %s key domain after an internal child failure', (name, createKey) => {
		const reached = vi.fn()
		const result = v.record({
			key: createKey(),
			value: v.unknown()
				.observe(reached)
				.internalFailure(),
			collectAllIssues: true,
		})
			.execute({ first: 'value', second: 'not reached' })

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					path: ['first'],
					payload: { method: 'internalFailure' },
				}],
			})
		expect((result as any).issues)
			.toHaveLength(1)
		expect(reached, name)
			.toHaveBeenCalledTimes(1)
	})
})
