import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { bigint, boolean, createValchecker, number, string, toNumber, unknown } from '../..'

const v = createValchecker({ steps: [bigint, boolean, number, string, toNumber, unknown] })

describe('toNumber step plugin', () => {
	it.each([
		['42', 42],
		['abc', Number.NaN],
		// An empty or whitespace-only string coerces to 0; a parser would reject both.
		['', 0],
		['   ', 0],
		['Infinity', Infinity],
		// Radix prefixes are part of the numeric grammar `Number()` accepts.
		['0x10', 16],
		['1e3', 1000],
	] as const)('applies Number() to string %j', (value, expected) => {
		expect(v.string()
			.toNumber()
			.execute(value))
			.toEqual({ value: expected })
	})

	it.each([
		[true, 1],
		[false, 0],
	] as const)('applies Number() to boolean %s', (value, expected) => {
		expect(v.boolean()
			.toNumber()
			.execute(value))
			.toEqual({ value: expected })
	})

	it('preserves native bigint conversion semantics, including precision loss', () => {
		expect(v.bigint()
			.toNumber()
			.execute(42n))
			.toEqual({ value: 42 })
		expect(v.bigint()
			.toNumber()
			.execute(9007199254740993n))
			.toEqual({ value: 9007199254740992 })
	})

	it.each([
		// `null` coerces to 0 while `undefined` coerces to NaN, and an array is
		// coerced through its joined string: `[]` is 0 and `['1']` is 1.
		[null, 0],
		[undefined, Number.NaN],
		[{}, Number.NaN],
		[[], 0],
		[['1'], 1],
		[['1', '2'], Number.NaN],
	] as const)('applies Number() to non-number value %j', (value, expected) => {
		expect(v.unknown()
			.toNumber()
			.execute(value))
			.toEqual({ value: expected })
	})

	it('converts native Number() exceptions into issues', () => {
		const value = Symbol('value')
		const result = v.unknown()
			.toNumber()
			.execute(value)
		expect(result)
			.toMatchObject({
				issues: [{
					code: 'toNumber:conversion_failed',
					category: 'operation',
					message: 'Expected a value convertible to number.',
					path: [],
					payload: { value },
				}],
			})
		expect((result as any).issues[0].payload.error)
			.toBeInstanceOf(TypeError)
	})

	it('supports custom messages', () => {
		expect(v.unknown()
			.toNumber({ message: 'Custom number' })
			.execute(Symbol('value')))
			.toMatchObject({
				issues: [{ message: 'Custom number' }],
			})
	})

	it('infers number output and is unavailable after number()', () => {
		const _schema = v.unknown()
			.toNumber()
		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<number>()
		if (false) {
			// @ts-expect-error toNumber is unavailable once the output is already number
			v.number().toNumber() // eslint-disable-line style/newline-per-chained-call -- single line keeps the directive covering the whole unreachable negative-type expression
		}
	})
})
