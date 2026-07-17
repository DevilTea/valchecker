import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { bigint, boolean, createValchecker, number, string, toBoolean, unknown } from '../..'

const v = createValchecker({ steps: [bigint, boolean, number, string, toBoolean, unknown] })

describe('toBoolean step plugin', () => {
	it.each([
		['', false],
		['false', true],
		['0', true],
		['no', true],
	] as const)('applies Boolean() to string %j', (value, expected) => {
		expect(v.string().toBoolean().execute(value)).toEqual({ value: expected })
	})

	it.each([
		[0, false],
		[-0, false],
		[Number.NaN, false],
		[1, true],
		[Infinity, true],
	] as const)('applies Boolean() to number %s', (value, expected) => {
		expect(v.number().toBoolean().execute(value)).toEqual({ value: expected })
	})

	it.each([
		[0n, false],
		[1n, true],
		[-1n, true],
	] as const)('applies Boolean() to bigint %s', (value, expected) => {
		expect(v.bigint().toBoolean().execute(value)).toEqual({ value: expected })
	})

	it.each([
		[null, false],
		[undefined, false],
		[{}, true],
		[[], true],
		[Symbol('value'), true],
	] as const)('applies Boolean() to arbitrary non-boolean values', (value, expected) => {
		expect(v.unknown().toBoolean().execute(value)).toEqual({ value: expected })
	})

	it('infers boolean output and is unavailable after boolean()', () => {
		const schema = v.unknown().toBoolean()
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<boolean>()
		expectTypeOf(v.boolean().toBoolean).toBeNever()
	})
})
