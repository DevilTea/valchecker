/**
 * Test plan for json step:
 * - Functions tested: json validation with optional custom messages.
 * - Valid inputs: valid JSON strings (objects, arrays, primitives).
 * - Invalid inputs: invalid JSON strings, malformed JSON.
 * - Edge cases: empty string, unicode.
 * - Expected behaviors: Success returns { value: string }; failure returns { issues: [{ code: 'json:invalid_json', payload: { value, error }, message }] }.
 * - Error handling: No exceptions; all errors via issues.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, json, string } from '../..'

const v = createValchecker({ steps: [string, json] })

describe('json plugin', () => {
	describe('valid inputs', () => {
		it('should pass for valid JSON object', () => {
			const json = '{"name": "John", "age": 30}'
			const result = v
				.string()
				.json()
				.execute(json)
			expect(result)
				.toEqual({ value: json })
		})

		it('should pass for valid JSON array', () => {
			const json = '[1, 2, 3]'
			const result = v
				.string()
				.json()
				.execute(json)
			expect(result)
				.toEqual({ value: json })
		})

		it('should pass for valid JSON string', () => {
			const json = '"hello"'
			const result = v
				.string()
				.json()
				.execute(json)
			expect(result)
				.toEqual({ value: json })
		})

		it('should pass for valid JSON number', () => {
			const json = '42'
			const result = v
				.string()
				.json()
				.execute(json)
			expect(result)
				.toEqual({ value: json })
		})

		it('should pass for valid JSON boolean', () => {
			const json = 'true'
			const result = v
				.string()
				.json()
				.execute(json)
			expect(result)
				.toEqual({ value: json })
		})

		it('should pass for valid JSON null', () => {
			const json = 'null'
			const result = v
				.string()
				.json()
				.execute(json)
			expect(result)
				.toEqual({ value: json })
		})

		it('should pass for empty object', () => {
			const json = '{}'
			const result = v
				.string()
				.json()
				.execute(json)
			expect(result)
				.toEqual({ value: json })
		})

		it('should pass for empty array', () => {
			const json = '[]'
			const result = v
				.string()
				.json()
				.execute(json)
			expect(result)
				.toEqual({ value: json })
		})

		it('should pass for unicode JSON', () => {
			const json = '{"message": "你好"}'
			const result = v
				.string()
				.json()
				.execute(json)
			expect(result)
				.toEqual({ value: json })
		})
	})

	describe('invalid inputs', () => {
		it('should fail for invalid JSON string', () => {
			const result = v
				.string()
				.json()
				.execute('{invalid}')
			expect(result)
				.toEqual({
					issues: [{
						code: 'json:invalid_json',
						payload: { value: '{invalid}', error: expect.anything() },
						message: 'Expected a valid JSON string.',
					}],
				})
		})

		it('should fail for malformed JSON', () => {
			const result = v
				.string()
				.json()
				.execute('{"name": }')
			expect(result)
				.toEqual({
					issues: [{
						code: 'json:invalid_json',
						payload: { value: '{"name": }', error: expect.anything() },
						message: 'Expected a valid JSON string.',
					}],
				})
		})

		it('should fail for empty string', () => {
			const result = v
				.string()
				.json()
				.execute('')
			expect(result)
				.toEqual({
					issues: [{
						code: 'json:invalid_json',
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
				.json('Custom error message')
				.execute('')
			expect(result)
				.toEqual({
					issues: [{
						code: 'json:invalid_json',
						payload: { value: '', error: expect.anything() },
						message: 'Custom error message',
					}],
				})
		})
	})
})
