import { describe, expect, it } from 'vitest'
import { bigint, createValchecker, isAtLeast, number } from '../..'

const v = createValchecker({ steps: [number, bigint, isAtLeast] })

describe('isAtLeast step plugin', () => {
	it.each([
		[v.number()
			.isAtLeast(10), 10],
		[v.number()
			.isAtLeast(10), 15],
		[v.bigint()
			.isAtLeast(10n), 15n],
	] as const)('accepts numeric values at or above the minimum', (schema, value) => {
		expect(schema.execute(value as never))
			.toEqual({ value })
	})

	it('rejects numeric values below the minimum', () => {
		expect(v.number()
			.isAtLeast(10)
			.execute(5))
			.toEqual({
				issues: [{
					code: 'isAtLeast:expected_at_least',
					category: 'validation',
					message: 'Expected a value of at least 10.',
					path: [],
					payload: { target: 'number', value: 5, minimum: 10 },
				}],
			})
		expect(v.bigint()
			.isAtLeast(10n)
			.execute(5n))
			.toMatchObject({
				issues: [{ payload: { target: 'bigint', value: 5n, minimum: 10n } }],
			})
	})

	it('supports custom messages', () => {
		expect(v.number()
			.isAtLeast(10, { message: 'Custom minimum' })
			.execute(5))
			.toMatchObject({
				issues: [{ message: 'Custom minimum' }],
			})
	})
})
