import { describe, expect, it } from 'vitest'
import { array, bigint, createValchecker, isAtMost, isLengthAtMost, number, string } from '../..'

const v = createValchecker({ steps: [number, bigint, string, array, isAtMost, isLengthAtMost] })

describe('maximum validation plugins', () => {
	it.each([
		[v.number().isAtMost(10), 10],
		[v.number().isAtMost(10), 5],
		[v.bigint().isAtMost(10n), 5n],
	] as const)('accepts numeric values at or below the maximum', (schema, value) => {
		expect(schema.execute(value as never)).toEqual({ value })
	})

	it('rejects numeric values above the maximum', () => {
		expect(v.number().isAtMost(10).execute(15)).toEqual({
			issues: [{
				code: 'isAtMost:expected_at_most',
				message: 'Expected a value of at most 10.',
				path: [],
				payload: { target: 'number', value: 15, maximum: 10 },
			}],
		})
		expect(v.bigint().isAtMost(10n).execute(15n)).toMatchObject({
			issues: [{ payload: { target: 'bigint', value: 15n, maximum: 10n } }],
		})
	})

	it.each([
		[v.string().isLengthAtMost(5), 'hello'],
		[v.array(v.number()).isLengthAtMost(2), [1, 2]],
	] as const)('accepts values meeting maximum length', (schema, value) => {
		expect(schema.execute(value as never)).toEqual({ value })
	})

	it('rejects values above maximum length', () => {
		expect(v.string().isLengthAtMost(3).execute('hello')).toEqual({
			issues: [{
				code: 'isLengthAtMost:expected_length_at_most',
				message: 'Expected a length of at most 3.',
				path: [],
				payload: { value: 'hello', maximum: 3 },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.number().isAtMost(10, 'Custom maximum').execute(15)).toMatchObject({
			issues: [{ message: 'Custom maximum' }],
		})
		expect(v.string().isLengthAtMost(3, 'Custom length').execute('hello')).toMatchObject({
			issues: [{ message: 'Custom length' }],
		})
	})
})