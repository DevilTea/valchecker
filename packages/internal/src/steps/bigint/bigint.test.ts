import { describe, expect, it } from 'vitest'
import { bigint, createValchecker, isAtLeast } from '../..'

const v = createValchecker({ steps: [bigint, isAtLeast] })

describe('bigint step plugin', () => {
	it.each([1n, 0n, -1n, 123456789012345678901234567890n])('accepts bigint %p', (value) => {
		expect(v.bigint().execute(value)).toEqual({ value })
	})

	it.each([
		42,
		'hello',
		true,
		null,
		undefined,
		{},
		[],
		Symbol('test'),
	])('rejects non-bigint %p', (value) => {
		expect(v.bigint().execute(value)).toEqual({
			issues: [{
				code: 'bigint:expected_bigint',
				message: 'Expected a bigint.',
				path: [],
				payload: { value },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.bigint('Custom error message').execute(42)).toEqual({
			issues: [{
				code: 'bigint:expected_bigint',
				message: 'Custom error message',
				path: [],
				payload: { value: 42 },
			}],
		})
	})

	it('chains with numeric minimum validation', () => {
		expect(v.bigint().isAtLeast(5n).execute(10n)).toEqual({ value: 10n })
		expect(v.bigint().isAtLeast(5n).execute(3n)).toEqual({
			issues: [{
				code: 'isAtLeast:expected_at_least',
				message: 'Expected a value of at least 5.',
				path: [],
				payload: { target: 'bigint', value: 3n, minimum: 5n },
			}],
		})
	})
})