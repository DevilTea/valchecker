import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { bigint, createValchecker, number, toSafeNumber } from '../..'

const v = createValchecker({ steps: [bigint, number, toSafeNumber] })
const minimum = BigInt(Number.MIN_SAFE_INTEGER)
const maximum = BigInt(Number.MAX_SAFE_INTEGER)

describe('toSafeNumber step plugin', () => {
	it.each([
		[minimum, Number.MIN_SAFE_INTEGER],
		[-1n, -1],
		[0n, 0],
		[1n, 1],
		[maximum, Number.MAX_SAFE_INTEGER],
	] as const)('converts safe bigint %s', (value, expected) => {
		expect(v.bigint()
			.toSafeNumber()
			.execute(value))
			.toEqual({ value: expected })
	})

	it.each([
		minimum - 1n,
		maximum + 1n,
	])('rejects bigint outside the safe integer range: %s', (value) => {
		expect(v.bigint()
			.toSafeNumber()
			.execute(value))
			.toEqual({
				issues: [{
					code: 'toSafeNumber:out_of_safe_integer_range',
					category: 'validation',
					message: 'Expected the bigint to be within the safe integer range.',
					path: [],
					payload: { value, minimum, maximum },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.bigint()
			.toSafeNumber({ message: 'Custom safe range' })
			.execute(maximum + 1n))
			.toMatchObject({
				issues: [{ message: 'Custom safe range' }],
			})
	})

	it('infers number output and is unavailable outside bigint()', () => {
		const schema = v.bigint()
			.toSafeNumber()
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<number>()
		expectTypeOf(v.number().toSafeNumber)
			.toBeNever()
	})
})
