/**
 * Test plan for stringifyJSON step:
 * - Functions tested: stringifyJSON transformation with optional custom messages.
 * - Valid inputs: serializable values (objects, arrays, primitives, null, undefined).
 * - Invalid inputs: unserializable values (functions, circular references, Symbols, BigInts).
 * - Edge cases: empty object/array, nested structures, undefined values.
 * - Expected behaviors: Success returns { value: jsonString }; failure returns { issues: [{ code: 'stringifyJSON:unserializable', payload: { value }, message }] }.
 * - Error handling: No exceptions; all errors via issues.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, stringifyJSON } from '../..'

const v = createValchecker({ steps: [stringifyJSON] })

describe('stringifyJSON plugin', () => {
	describe('valid inputs', () => {
		it('should stringify object', () => {
			const obj = { name: 'John', age: 30 }
			const result = v.stringifyJSON()
				.execute(obj)
			expect(result)
				.toEqual({ value: '{"name":"John","age":30}' })
		})

		it('should stringify array', () => {
			const arr = [1, 2, 3]
			const result = v.stringifyJSON()
				.execute(arr)
			expect(result)
				.toEqual({ value: '[1,2,3]' })
		})

		it('should stringify string', () => {
			const result = v.stringifyJSON()
				.execute('hello')
			expect(result)
				.toEqual({ value: '"hello"' })
		})

		it('should stringify number', () => {
			const result = v.stringifyJSON()
				.execute(42)
			expect(result)
				.toEqual({ value: '42' })
		})

		it('should stringify boolean', () => {
			const result = v.stringifyJSON()
				.execute(true)
			expect(result)
				.toEqual({ value: 'true' })
		})

		it('should stringify null', () => {
			const result = v.stringifyJSON()
				.execute(null)
			expect(result)
				.toEqual({ value: 'null' })
		})

		it('should stringify undefined', () => {
			const result = v.stringifyJSON()
				.execute(undefined)
			expect(result)
				.toEqual({
					issues: [{
						code: 'stringifyJSON:unserializable',
						payload: { value: undefined },
						message: 'Value cannot be serialized to JSON.',
					}],
				})
		})

		it('should stringify empty object', () => {
			const result = v.stringifyJSON()
				.execute({})
			expect(result)
				.toEqual({ value: '{}' })
		})

		it('should stringify empty array', () => {
			const result = v.stringifyJSON()
				.execute([])
			expect(result)
				.toEqual({ value: '[]' })
		})

		it('should stringify nested structure', () => {
			const nested = { user: { name: 'John' }, items: [1, 2] }
			const result = v.stringifyJSON()
				.execute(nested)
			expect(result)
				.toEqual({ value: '{"user":{"name":"John"},"items":[1,2]}' })
		})
	})

	describe('invalid inputs', () => {
		it('should fail for function', () => {
			const func = () => {}
			const result = v.stringifyJSON()
				.execute(func)
			expect(result)
				.toEqual({
					issues: [{
						code: 'stringifyJSON:unserializable',
						payload: { value: func },
						message: 'Value cannot be serialized to JSON.',
					}],
				})
		})

		it('should fail for circular reference', () => {
			const obj: any = { name: 'test' }
			obj.self = obj
			const result = v.stringifyJSON()
				.execute(obj)
			expect(result)
				.toEqual({
					issues: [{
						code: 'stringifyJSON:unserializable',
						payload: { value: obj },
						message: 'Value cannot be serialized to JSON.',
					}],
				})
		})

		it('should fail for Symbol', () => {
			const sym = Symbol('test')
			const result = v.stringifyJSON()
				.execute(sym)
			expect(result)
				.toEqual({
					issues: [{
						code: 'stringifyJSON:unserializable',
						payload: { value: sym },
						message: 'Value cannot be serialized to JSON.',
					}],
				})
		})

		it('should fail for BigInt', () => {
			const result = v.stringifyJSON()
				.execute(123n)
			expect(result)
				.toEqual({
					issues: [{
						code: 'stringifyJSON:unserializable',
						payload: { value: 123n },
						message: 'Value cannot be serialized to JSON.',
					}],
				})
		})

		it('should fail for object with function', () => {
			const obj = { name: 'John', func: () => {} }
			const result = v.stringifyJSON()
				.execute(obj)
			expect(result)
				.toEqual({
					issues: [{
						code: 'stringifyJSON:unserializable',
						payload: { value: obj },
						message: 'Value cannot be serialized to JSON.',
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for unserializable value', () => {
			const result = v.stringifyJSON('Custom error message')
				.execute(() => {})
			expect(result)
				.toEqual({
					issues: [{
						code: 'stringifyJSON:unserializable',
						payload: { value: expect.any(Function) },
						message: 'Custom error message',
					}],
				})
		})
	})
})
