import { describe, expect, it } from 'vitest'
import { check, createValchecker, null_ } from '../..'

const v = createValchecker({ steps: [null_, check] })

describe('null plugin', () => {
	describe('valid values', () => {
		it('should pass for null', () => {
			const result = v.null()
				.execute(null)
			expect(result)
				.toEqual({ value: null })
		})
	})

	describe('invalid values', () => {
		it('should fail for number', () => {
			const result = v.null()
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						category: 'validation',
						message: 'Expected null.',
						path: [],
						payload: { value: 42 },
					}],
				})
		})

		it('should fail for string', () => {
			const result = v.null()
				.execute('null')
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						category: 'validation',
						message: 'Expected null.',
						path: [],
						payload: { value: 'null' },
					}],
				})
		})

		it('should fail for boolean', () => {
			const result = v.null()
				.execute(false)
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						category: 'validation',
						message: 'Expected null.',
						path: [],
						payload: { value: false },
					}],
				})
		})

		it('should fail for undefined', () => {
			const result = v.null()
				.execute(undefined)
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						category: 'validation',
						message: 'Expected null.',
						path: [],
						payload: { value: undefined },
					}],
				})
		})

		it('should fail for object', () => {
			const obj = {}
			const result = v.null()
				.execute(obj)
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						category: 'validation',
						message: 'Expected null.',
						path: [],
						payload: { value: obj },
					}],
				})
		})

		it('should fail for array', () => {
			const arr: unknown[] = []
			const result = v.null()
				.execute(arr)
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						category: 'validation',
						message: 'Expected null.',
						path: [],
						payload: { value: arr },
					}],
				})
		})

		it('should fail for bigint', () => {
			const result = v.null()
				.execute(123n)
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						category: 'validation',
						message: 'Expected null.',
						path: [],
						payload: { value: 123n },
					}],
				})
		})

		it('should fail for symbol', () => {
			const sym = Symbol('test')
			const result = v.null()
				.execute(sym)
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						category: 'validation',
						message: 'Expected null.',
						path: [],
						payload: { value: sym },
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.null({ message: 'Custom error message' })
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						category: 'validation',
						message: 'Custom error message',
						path: [],
						payload: { value: 42 },
					}],
				})
		})
	})

	describe('chaining', () => {
		it('should chain with check', () => {
			const result = v.null()
				.check(value => value === null)
				.execute(null)
			expect(result)
				.toEqual({ value: null })
		})

		it('should fail chaining with check', () => {
			const result = v.null()
				.check(() => false)
				.execute(null)
			expect(result)
				.toEqual({
					issues: [{
						code: 'check:failed',
						category: 'validation',
						message: 'Check failed',
						path: [],
						payload: { reason: 'returned_false', value: null },
					}],
				})
		})
	})
})
