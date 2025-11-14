/**
 * Test plan for parseJSON step:
 * - Functions tested: parseJSON transformation with optional type parameter and custom messages.
 * - Valid inputs: valid JSON strings (objects, arrays, primitives).
 * - Invalid inputs: invalid JSON strings, malformed JSON.
 * - Edge cases: empty string, unicode.
 * - Expected behaviors: Success returns { value: parsedValue }; failure returns { issues: [{ code: 'parseJSON:invalid_json', payload: { value, error }, message }] }.
 * - Error handling: No exceptions; all errors via issues.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, parseJSON, string } from '../..'

const v = createValchecker({ steps: [string, parseJSON] })

describe('parseJSON plugin', () => {
	describe('valid inputs', () => {
		it('should parse JSON object', () => {
			const json = '{"name": "John", "age": 30}'
			const result = v
				.string()
				.parseJSON()
				.execute(json)
			expect(result).toEqual({ value: { name: 'John', age: 30 } })
		})

		it('should parse JSON array', () => {
			const json = '[1, 2, 3]'
			const result = v
				.string()
				.parseJSON()
				.execute(json)
			expect(result).toEqual({ value: [1, 2, 3] })
		})

		it('should parse JSON string', () => {
			const json = '"hello"'
			const result = v
				.string()
				.parseJSON()
				.execute(json)
			expect(result).toEqual({ value: 'hello' })
		})

		it('should parse JSON number', () => {
			const json = '42'
			const result = v
				.string()
				.parseJSON()
				.execute(json)
			expect(result).toEqual({ value: 42 })
		})

		it('should parse JSON boolean', () => {
			const json = 'true'
			const result = v
				.string()
				.parseJSON()
				.execute(json)
			expect(result).toEqual({ value: true })
		})

		it('should parse JSON null', () => {
			const json = 'null'
			const result = v
				.string()
				.parseJSON()
				.execute(json)
			expect(result).toEqual({ value: null })
		})

		it('should parse empty object', () => {
			const json = '{}'
			const result = v
				.string()
				.parseJSON()
				.execute(json)
			expect(result).toEqual({ value: {} })
		})

		it('should parse empty array', () => {
			const json = '[]'
			const result = v
				.string()
				.parseJSON()
				.execute(json)
			expect(result).toEqual({ value: [] })
		})

		it('should parse unicode JSON', () => {
			const json = '{"message": "你好"}'
			const result = v
				.string()
				.parseJSON()
				.execute(json)
			expect(result).toEqual({ value: { message: '你好' } })
		})
	})

	describe('invalid inputs', () => {
		it('should fail for invalid JSON string', () => {
			const result = v
				.string()
				.parseJSON()
				.execute('{invalid}')
			expect(result).toEqual({
				issues: [{
					code: 'parseJSON:invalid_json',
					payload: { value: '{invalid}', error: expect.anything() },
					message: 'Expected a valid JSON string.',
				}],
			})
		})

		it('should fail for malformed JSON', () => {
			const result = v
				.string()
				.parseJSON()
				.execute('{"name": }')
			expect(result).toEqual({
				issues: [{
					code: 'parseJSON:invalid_json',
					payload: { value: '{"name": }', error: expect.anything() },
					message: 'Expected a valid JSON string.',
				}],
			})
		})

		it('should fail for empty string', () => {
			const result = v
				.string()
				.parseJSON()
				.execute('')
			expect(result).toEqual({
				issues: [{
					code: 'parseJSON:invalid_json',
					payload: { value: '', error: expect.anything() },
					message: 'Expected a valid JSON string.',
				}],
			})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v
				.string()
				.parseJSON('Custom error message')
				.execute('')
			expect(result).toEqual({
				issues: [{
					code: 'parseJSON:invalid_json',
					payload: { value: '', error: expect.anything() },
					message: 'Custom error message',
				}],
			})
		})
	})

	describe('chaining', () => {
		it('should chain after string validation', () => {
			const result = v
				.string()
				.parseJSON()
				.execute('{"key": "value"}')
			expect(result).toEqual({ value: { key: 'value' } })
		})
	})
})
