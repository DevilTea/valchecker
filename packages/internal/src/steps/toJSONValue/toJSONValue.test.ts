import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, number, string, toJSONValue } from '../..'

const v = createValchecker({ steps: [number, string, toJSONValue] })

describe('toJSONValue step plugin', () => {
	it('parses JSON values', () => {
		expect(v.string()
			.toJSONValue<{ value: number }>()
			.execute('{"value":42}'))
			.toEqual({
				value: { value: 42 },
			})
	})

	it.each([
		// A bare JSON literal is a document of its own, and surrounding whitespace
		// is insignificant: parsing, not a structural check.
		['null', null],
		['42', 42],
		['"text"', 'text'],
		['  {"value":1}  ', { value: 1 }],
	] as const)('parses the standalone JSON document %j', (value, expected) => {
		expect(v.string()
			.toJSONValue()
			.execute(value))
			.toEqual({ value: expected })
	})

	it('reports the empty string, which is not a JSON document', () => {
		expect(v.string()
			.toJSONValue()
			.execute(''))
			.toMatchObject({
				issues: [{
					code: 'toJSONValue:invalid_json',
					payload: { value: '' },
				}],
			})
	})

	it('reports invalid JSON', () => {
		const result = v.string()
			.toJSONValue()
			.execute('{')
		expect(result)
			.toMatchObject({
				issues: [{
					code: 'toJSONValue:invalid_json',
					category: 'validation',
					message: 'Expected a valid JSON string.',
					path: [],
					payload: { value: '{' },
				}],
			})
		expect((result as any).issues[0].payload.error)
			.toBeInstanceOf(SyntaxError)
	})

	it('supports custom messages', () => {
		expect(v.string()
			.toJSONValue({ message: 'Custom JSON' })
			.execute('{'))
			.toMatchObject({
				issues: [{ message: 'Custom JSON' }],
			})
	})

	it('infers the asserted output type, unknown by default, and is unavailable outside a string output', () => {
		const _default = v.string()
			.toJSONValue()
		const _asserted = v.string()
			.toJSONValue<{ value: number }>()
		expectTypeOf<InferOutput<typeof _default>>()
			.toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<typeof _asserted>>()
			.toEqualTypeOf<{ value: number }>()
		if (false) {
			// @ts-expect-error toJSONValue is unavailable when the output is not string
			v.number().toJSONValue() // eslint-disable-line style/newline-per-chained-call -- single line keeps the directive covering the whole unreachable negative-type expression
		}
	})
})
