import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { bigint, boolean, createValchecker, number, string, toBigint, unknown } from '../..'

const v = createValchecker({ steps: [bigint, boolean, number, string, toBigint, unknown] })

describe('toBigint step plugin', () => {
	it.each([
		['42', 42n],
		['', 0n],
		['0x10', 16n],
	] as const)('applies BigInt() to string %j', (value, expected) => {
		expect(v.string().toBigint().execute(value)).toEqual({ value: expected })
	})

	it.each([
		[42, 42n],
		[-0, 0n],
	] as const)('applies BigInt() to integer number %s', (value, expected) => {
		expect(v.number().toBigint().execute(value)).toEqual({ value: expected })
	})

	it.each([
		[true, 1n],
		[false, 0n],
	] as const)('applies BigInt() to boolean %s', (value, expected) => {
		expect(v.boolean().toBigint().execute(value)).toEqual({ value: expected })
	})

	it('applies native object-to-primitive conversion', () => {
		const value = { valueOf: () => 42 }
		expect(v.unknown().toBigint().execute(value)).toEqual({ value: 42n })
	})

	it.each([
		['invalid'],
		['1.5'],
	] as const)('reports invalid string %j', (value) => {
		const result = v.string().toBigint().execute(value)
		expect(result).toMatchObject({
			issues: [{
				code: 'toBigint:invalid_bigint',
				message: 'Expected a value convertible to bigint.',
				path: [],
				payload: { value },
			}],
		})
		expect((result as any).issues[0].payload.error).toBeInstanceOf(Error)
	})

	it.each([1.5, Number.NaN, Infinity, -Infinity])('reports invalid number %s', (value) => {
		expect(v.number().toBigint().execute(value)).toMatchObject({
			issues: [{
				code: 'toBigint:invalid_bigint',
				payload: { value },
			}],
		})
	})

	it.each([null, undefined, Symbol('value')])('reports arbitrary values rejected by BigInt()', (value) => {
		expect(v.unknown().toBigint().execute(value)).toMatchObject({
			issues: [{
				code: 'toBigint:invalid_bigint',
				payload: { value },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.unknown().toBigint('Custom bigint').execute(null)).toMatchObject({
			issues: [{ message: 'Custom bigint' }],
		})
	})

	it('infers bigint output and is unavailable after bigint()', () => {
		const schema = v.unknown().toBigint()
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<bigint>()
		expectTypeOf(v.bigint().toBigint).toBeNever()
	})
})
