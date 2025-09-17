import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { number, NumberSchema } from './number'

describe('tests of `number`', () => {
	describe('happy path cases', () => {
		it('case 1: Create number schema without parameters', () => {
			const schema = number()
			expect(schema).toBeInstanceOf(NumberSchema)
		})

		it('case 2: Create number schema with custom message', () => {
			const schema = number({ EXPECTED_NUMBER: 'Custom message' })
			expect(schema).toBeInstanceOf(NumberSchema)
		})

		it('case 3: Create number schema allowing NaN', () => {
			const schema = number(true)
			expect(schema).toBeInstanceOf(NumberSchema)
		})

		it('case 4: Create number schema allowing NaN with custom message', () => {
			const schema = number(true, { EXPECTED_NUMBER: 'Custom message' })
			expect(schema).toBeInstanceOf(NumberSchema)
		})
	})

	describe('edge cases', () => {
		it('case 1: Validate number values (allowNaN: false)', () => {
			const schema = number()
			const result = schema.execute(42)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe(42)
			}
		})

		it('case 2: Validate NaN (allowNaN: false)', () => {
			const schema = number()
			const result = schema.execute(Number.NaN)
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected number.')
			}
		})

		it('case 3: Validate number values (allowNaN: true)', () => {
			const schema = number(true)
			const result = schema.execute(42)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe(42)
			}
		})

		it('case 4: Validate NaN (allowNaN: true)', () => {
			const schema = number(true)
			const result = schema.execute(Number.NaN)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(Number.isNaN(result.value)).toBe(true)
			}
		})

		it('case 5: Validate non-number values', () => {
			const schema = number()
			const result = schema.execute('string')
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected number.')
			}
		})

		it('case 6: Validate special number values', () => {
			const schema = number()
			const result = schema.execute(Infinity)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe(Infinity)
			}
		})

		it('case 7: Validate negative zero', () => {
			const schema = number()
			const result = schema.execute(-0)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe(-0)
				expect(1 / result.value).toBe(-Infinity) // Verify it's actually -0
			}
		})
	})
})

describe('tests of `NumberSchema`', () => {
	describe('happy path cases', () => {
		it('case 1: Instantiate and validate', () => {
			const schema = new NumberSchema({ meta: { allowNaN: false } })
			const result = schema.execute(42)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe(42)
			}
		})
	})
})
