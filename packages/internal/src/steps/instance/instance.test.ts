import type { InferOutput } from '../..'
import { runInNewContext } from 'node:vm'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { check, createValchecker, instance } from '../..'

const v = createValchecker({ steps: [instance, check] })

describe('instance step plugin', () => {
	it('accepts an instance of the configured class and preserves the reference', () => {
		const date = new Date()
		const result = v.instance(Date)
			.execute(date)
		expect(result)
			.toEqual({ value: date })
		if (v.isSuccess(result)) {
			expect(result.value)
				.toBe(date)
		}
	})

	it('accepts an instance of a subclass, because `instanceof` walks the prototype chain', () => {
		class Base {}
		class Derived extends Base {}
		const derived = new Derived()
		expect(v.instance(Base)
			.execute(derived))
			.toEqual({ value: derived })
		expect(v.instance(Derived)
			.execute(new Base()))
			.toMatchObject({ issues: [{ code: 'instance:expected_instance' }] })
	})

	it('reports the configured class in the payload and the default message', () => {
		expect(v.instance(Date)
			.execute('not a date'))
			.toEqual({
				issues: [{
					code: 'instance:expected_instance',
					category: 'validation',
					message: 'Expected instance of Date.',
					path: [],
					payload: { value: 'not a date', expected: Date },
				}],
			})
	})

	it.each([
		null,
		undefined,
		42,
		'2026-01-01',
		{},
		[],
		Object.create(null),
	])('rejects %p for a Date schema', (value) => {
		expect(v.instance(Date)
			.execute(value))
			.toMatchObject({
				issues: [{
					code: 'instance:expected_instance',
					payload: { value, expected: Date },
				}],
			})
	})

	it('separates a boxed primitive from its primitive form', () => {
		const boxed = new Object('hello')
		expect(v.instance(String)
			.execute(boxed))
			.toEqual({ value: boxed })
		expect(v.instance(String)
			.execute('hello'))
			.toMatchObject({
				issues: [{
					code: 'instance:expected_instance',
					payload: { value: 'hello', expected: String },
				}],
			})
		expect(v.instance(Number)
			.execute(42))
			.toMatchObject({ issues: [{ code: 'instance:expected_instance' }] })
	})

	it('honours a `Symbol.hasInstance` override instead of reading the prototype itself', () => {
		class Even {
			static [Symbol.hasInstance](value: unknown): boolean {
				return typeof value === 'number' && value % 2 === 0
			}
		}
		expect(v.instance(Even)
			.execute(2))
			.toEqual({ value: 2 })
		expect(v.instance(Even)
			.execute(3))
			.toMatchObject({
				issues: [{
					code: 'instance:expected_instance',
					message: 'Expected instance of Even.',
					payload: { value: 3, expected: Even },
				}],
			})
	})

	it('rejects a cross-realm instance, because `instanceof` compares one realm\'s prototype', () => {
		const foreignDate = runInNewContext('new Date()') as Date
		expect(Object.prototype.toString.call(foreignDate))
			.toBe('[object Date]')
		expect(v.instance(Date)
			.execute(foreignDate))
			.toMatchObject({
				issues: [{
					code: 'instance:expected_instance',
					payload: { value: foreignDate, expected: Date },
				}],
			})
	})

	it('supports a custom message', () => {
		expect(v.instance(Date, { message: () => 'Custom error message' })
			.execute('not a date'))
			.toEqual({
				issues: [{
					code: 'instance:expected_instance',
					category: 'validation',
					message: 'Custom error message',
					path: [],
					payload: { value: 'not a date', expected: Date },
				}],
			})
	})

	it('infers the constructor\'s instance type as the output', () => {
		class Custom {
			readonly tag = 'custom'
		}
		const schema = v.instance(Custom)
			.check(value => value.tag === 'custom')
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<Custom>()
		const custom = new Custom()
		expect(schema.execute(custom))
			.toEqual({ value: custom })
	})
})
