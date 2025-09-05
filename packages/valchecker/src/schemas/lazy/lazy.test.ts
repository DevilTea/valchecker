import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { string } from '../string'
import { lazy, LazySchema } from './lazy'

describe('tests of `lazy`', () => {
	describe('happy path cases', () => {
		it('case 1: Create lazy schema', () => {
			const schema = lazy(() => string())
			expect(schema).toBeInstanceOf(LazySchema)
		})
	})

	describe('edge cases', () => {
		it('case 1: Validate with lazy schema', () => {
			const schema = lazy(() => string())
			const result = schema.validate('test')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('test')
			}
		})

		it('case 2: Validate with invalid input', () => {
			const schema = lazy(() => string())
			const result = schema.validate(123)
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected string.')
			}
		})
	})
})

describe('tests of `LazySchema`', () => {
	describe('happy path cases', () => {
		it('case 1: Instantiate and validate', () => {
			const schema = new LazySchema({ meta: { getSchema: () => string() } })
			const result = schema.validate('test')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('test')
			}
		})
	})
})
