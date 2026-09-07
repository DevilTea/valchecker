import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { check, createValchecker, literal } from '../..'
import { getLiteralMembers } from './literal-members'

const v = createValchecker({ steps: [literal, check] })

describe('literal step plugin', () => {
	it.each([
		'hello',
		'',
		42,
		-1,
		0,
		123n,
		true,
		false,
	])('accepts the configured literal %p and preserves it', (value) => {
		expect(v.literal(value)
			.execute(value))
			.toEqual({ value })
	})

	it('matches a symbol by identity, not by description', () => {
		const sym = Symbol('test')
		const twin = Symbol('test')
		expect(v.literal(sym)
			.execute(sym))
			.toEqual({ value: sym })
		expect(v.literal(sym)
			.execute(twin))
			.toEqual({
				issues: [{
					code: 'literal:expected_literal',
					category: 'validation',
					message: 'Expected literal value "Symbol(test)".',
					path: [],
					payload: { value: twin, expected: sym },
				}],
			})
	})

	it('matches NaN against NaN, which `===` would reject', () => {
		expect(v.literal(Number.NaN)
			.execute(Number.NaN))
			.toEqual({ value: Number.NaN })
	})

	it('separates -0 from 0, which `===` and SameValueZero would conflate', () => {
		expect(v.literal(0)
			.execute(-0))
			.toEqual({
				issues: [{
					code: 'literal:expected_literal',
					category: 'validation',
					message: 'Expected literal value "0".',
					path: [],
					payload: { value: -0, expected: 0 },
				}],
			})
		expect(v.literal(-0)
			.execute(0))
			.toMatchObject({ issues: [{ code: 'literal:expected_literal' }] })
		expect(v.literal(-0)
			.execute(-0))
			.toEqual({ value: -0 })
	})

	it('reports the expected literal and the received value on a mismatch', () => {
		expect(v.literal('hello')
			.execute('world'))
			.toEqual({
				issues: [{
					code: 'literal:expected_literal',
					category: 'validation',
					message: 'Expected literal value "hello".',
					path: [],
					payload: { value: 'world', expected: 'hello' },
				}],
			})
	})

	it.each([
		[42, 43],
		[true, false],
		[123n, 124n],
		['', 'a'],
		['hello', 42],
		[42, '42'],
	])('rejects %p when the configured literal is %p', (expected, value) => {
		expect(v.literal(expected)
			.execute(value))
			.toMatchObject({
				issues: [{
					code: 'literal:expected_literal',
					payload: { value, expected },
				}],
			})
	})

	it('supports a custom message', () => {
		expect(v.literal('hello', { message: () => 'Custom error message' })
			.execute('world'))
			.toEqual({
				issues: [{
					code: 'literal:expected_literal',
					category: 'validation',
					message: 'Custom error message',
					path: [],
					payload: { value: 'world', expected: 'hello' },
				}],
			})
	})

	it('narrows the output to the configured literal type and stays chainable', () => {
		const schema = v.literal('hello')
			.check(value => value.length > 3)
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<'hello'>()
		expect(schema.execute('hello'))
			.toEqual({ value: 'hello' })
		if (false) {
			// @ts-expect-error literal is an initial schema; it is unavailable once the output is narrowed
			v.literal('a').literal('b') // eslint-disable-line style/newline-per-chained-call -- single line keeps the directive covering the whole unreachable negative-type expression
		}
	})

	describe('literal member declaration', () => {
		it('advertises the literal as an owned single-member snapshot', () => {
			const schema = v.literal('a')
			expect(getLiteralMembers(schema))
				.toEqual(['a'])
		})

		it('drops the member set after a further step chains', () => {
			expect(getLiteralMembers(v.literal('a')
				.check(() => true)))
				.toBeUndefined()
		})
	})
})
