import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { bigint, boolean, createValchecker, number, string, toNumber, unknown } from '../..'

const v = createValchecker({ steps: [bigint, boolean, number, string, toNumber, unknown] })

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

	it.each([
		[null, 0],
		[undefined, Number.NaN],
		[{}, Number.NaN],
	] as const)('applies Number() to non-number value %j', (value, expected) => {
		expect(v.unknown().toNumber().execute(value)).toEqual({ value: expected })
	})

	it('converts native Number() exceptions into issues', () => {
		const value = Symbol('value')
		const result = v.unknown().toNumber().execute(value)
		expect(result).toMatchObject({
			issues: [{
				code: 'toNumber:conversion_failed',
				message: 'Expected a value convertible to number.',
				path: [],
				payload: { value },
			}],
		})
		expect((result as any).issues[0].payload.error).toBeInstanceOf(TypeError)
	})

	it('supports custom messages', () => {
		expect(v.unknown().toNumber('Custom number').execute(Symbol('value'))).toMatchObject({
			issues: [{ message: 'Custom number' }],
		})
	})

	it('infers number output and is unavailable after number()', () => {
		const schema = v.unknown().toNumber()
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<number>()
		expectTypeOf(v.number().toNumber).toBeNever()
	})
})
