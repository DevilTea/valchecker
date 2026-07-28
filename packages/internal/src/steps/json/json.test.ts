import { describe, expect, it } from 'vitest'
import { createValchecker, json, string } from '../..'

const v = createValchecker({ steps: [string, json] })

describe('json step plugin', () => {
	it.each([
		'{"name": "John", "age": 30}',
		'{}',
		'[1, 2, 3]',
		'[]',
		'"hello"',
		'42',
		'-0.5e3',
		'true',
		'false',
		'null',
		'{"message": "你好"}',
		'  {"padded": true}\n',
	])('accepts the parseable JSON text %p', (value) => {
		expect(v.string()
			.json()
			.execute(value))
			.toEqual({ value })
	})

	it('outputs the original text, not the parsed value', () => {
		const text = '{"name":"John"}'
		const result = v.string()
			.json()
			.execute(text)
		expect(result)
			.toEqual({ value: text })
		if (v.isSuccess(result)) {
			expect(result.value)
				.toBe(text)
		}
	})

	it('reports the text and the thrown SyntaxError when parsing fails', () => {
		const result = v.string()
			.json()
			.execute('{invalid}')
		expect(result)
			.toEqual({
				issues: [{
					code: 'json:invalid_json',
					category: 'validation',
					message: 'Expected a valid JSON string.',
					path: [],
					payload: { value: '{invalid}', error: expect.any(SyntaxError) },
				}],
			})
	})

	it.each([
		'',
		'   ',
		'{"name": }',
		'{name: 1}',
		'\'single quoted\'',
		'undefined',
		'NaN',
		'[1, 2,]',
	])('rejects the unparseable text %p', (value) => {
		expect(v.string()
			.json()
			.execute(value))
			.toMatchObject({
				issues: [{ code: 'json:invalid_json', payload: { value } }],
			})
	})

	it('supports a custom message', () => {
		expect(v.string()
			.json({ message: 'Custom error message' })
			.execute(''))
			.toEqual({
				issues: [{
					code: 'json:invalid_json',
					category: 'validation',
					message: 'Custom error message',
					path: [],
					payload: { value: '', error: expect.any(SyntaxError) },
				}],
			})
	})

	it('is available only while the output is a string', () => {
		if (false) {
			// @ts-expect-error json requires a string output, which the initial instance does not have
			v.json()
		}
	})
})
