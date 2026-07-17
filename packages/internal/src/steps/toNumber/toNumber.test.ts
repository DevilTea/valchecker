import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { bigint, boolean, createValchecker, number, string, toNumber } from '../..'

const v = createValchecker({ steps: [bigint, boolean, number, string, toNumber] })

describe('toNumber step plugin', () => {
	it.each([
		['42', 42],
		['abc', Number.NaN],
		['', 0],
		['Infinity', Infinity],
	] as const)('applies Number() to string %j', (value, expected) => {
		expect(v.string().toNumber().execute(value)).toEqual({ value: expected })
	})

	it.each([
		[true, 1],
		[false, 0],
	] as const)('applies Number() to boolean %s', (value, expected) => {
		expect(v.boolean().toNumber().execute(value)).toEqual({ value: expected })
	})

	it('preserves native bigint conversion semantics, including precision loss', () => {
		expect(v.bigint().toNumber().execute(42n)).toEqual({ value: 42 })
		expect(v.bigint().toNumber().execute(9007199254740993n)).toEqual({ value: 9007199254740992 })
	})

	it('infers number output and is unavailable after number()', () => {
		const schema = v.string().toNumber()
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<number>()
		expectTypeOf(v.number().toNumber).toBeNever()
	})
})
