import { describe, expect, it } from 'vitest'
import { array, bigint, createValchecker, isAtLeast, isLengthAtLeast, number, string } from '../..'

const v = createValchecker({ steps: [number, bigint, string, array, isAtLeast, isLengthAtLeast] })

describe('minimum validation plugins', () => {
	it.each([
		[v.number().isAtLeast(10), 10],
		[v.number().isAtLeast(10), 15],
		[v.bigint().isAtLeast(10n), 15n],
	] as const)('accepts numeric values at or above the minimum', (schema, value) => {
		expect(schema.execute(value as never)).toEqual({ value })
	})

	it('rejects numeric values below the minimum', () => {
		expect(v.number().isAtLeast(10).execute(5)).toEqual({
			issues: [{
				code: 'isAtLeast:expected_at_least',
				message: 'Expected a value of at least 10.',
				path: [],
				payload: { target: 'number', value: 5, minimum: 10 },
			}],
		})
		expect(v.bigint().isAtLeast(10n).execute(5n)).toMatchObject({
			issues: [{ payload: { target: 'bigint', value: 5n, minimum: 10n } }],
		})
	})

	it.each([
		[v.string().isLengthAtLeast(3), 'hello'],
		[v.array(v.number()).isLengthAtLeast(2), [1, 2]],
	] as const)('accepts values meeting minimum length', (schema, value) => {
		expect(schema.execute(value as never)).toEqual({ value })
	})

	it('rejects values below minimum length', () => {
		expect(v.string().isLengthAtLeast(3).execute('hi')).toEqual({
			issues: [{
				code: 'isLengthAtLeast:expected_length_at_least',
				message: 'Expected a length of at least 3.',
				path: [],
				payload: { value: 'hi', minimum: 3 },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.number().isAtLeast(10, 'Custom minimum').execute(5)).toMatchObject({
			issues: [{ message: 'Custom minimum' }],
		})
		expect(v.string().isLengthAtLeast(3, 'Custom length').execute('')).toMatchObject({
			issues: [{ message: 'Custom length' }],
		})
	})
})