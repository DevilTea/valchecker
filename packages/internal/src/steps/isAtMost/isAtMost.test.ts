import { describe, expect, it } from 'vitest'
import { bigint, createValchecker, isAtMost, number } from '../..'

const v = createValchecker({ steps: [number, bigint, isAtMost] })

describe('isAtMost step plugin', () => {
	it.each([
		[v.number()
			.isAtMost(10), 10],
		[v.number()
			.isAtMost(10), 5],
		[v.bigint()
			.isAtMost(10n), 5n],
	] as const)('accepts numeric values at or below the maximum', (schema, value) => {
		expect(schema.execute(value as never))
			.toEqual({ value })
	})

	it('rejects numeric values above the maximum', () => {
		expect(v.number()
			.isAtMost(10)
			.execute(15))
			.toEqual({
				issues: [{
					code: 'isAtMost:expected_at_most',
					category: 'validation',
					message: 'Expected a value of at most 10.',
					path: [],
					payload: { target: 'number', value: 15, maximum: 10 },
				}],
			})
		expect(v.bigint()
			.isAtMost(10n)
			.execute(15n))
			.toMatchObject({
				issues: [{ payload: { target: 'bigint', value: 15n, maximum: 10n } }],
			})
	})

	it('supports custom messages', () => {
		expect(v.number()
			.isAtMost(10, { message: 'Custom maximum' })
			.execute(15))
			.toMatchObject({
				issues: [{ message: 'Custom maximum' }],
			})
	})
})
