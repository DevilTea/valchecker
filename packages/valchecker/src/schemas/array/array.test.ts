import { describe, expect, it } from 'vitest'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'
import { number } from '../number'
import { string } from '../string'
import { array, ArraySchema } from './array'

describe('tests of `array`', () => {
	describe('happy path cases', () => {
		it('case 1: Create array schema', () => {
			const schema = array(string())
			expect(schema).toBeInstanceOf(ArraySchema)
		})
	})

	describe('edge cases', () => {
		it('case 1: Validate empty array', async () => {
			const schema = array(string())
			const result = await schema.validate([])
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual([])
			}
		})

		it('case 2: Validate array with valid items', async () => {
			const schema = array(string())
			const result = await schema.validate(['a', 'b'])
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual(['a', 'b'])
			}
		})

		it('case 3: Validate array with invalid items', async () => {
			const schema = array(string())
			const result = await schema.validate(['a', 123])
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected string.')
				expect(result.issues[0]!.path).toEqual([1])
			}
		})

		it('case 4: Validate non-array value', async () => {
			const schema = array(string())
			const result = await schema.validate('not an array')
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected an array.')
			}
		})

		it('case 5: Validate array with mixed valid/invalid items', async () => {
			const schema = array(string())
			const result = await schema.validate(['valid', 123, 'also valid'])
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected string.')
				expect(result.issues[0]!.path).toEqual([1])
			}
		})

		it('case 6: Validate array with multiple invalid items', async () => {
			const schema = array(number())
			const result = await schema.validate([42, 'invalid', true, 3.14])
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(2)
				expect(result.issues[0]!.path).toEqual([1])
				expect(result.issues[1]!.path).toEqual([2])
			}
		})

		it('case 7: Validate array with transformed item schema', async () => {
			// Create a simple transformed schema for testing
			class SimpleTransformedSchema extends AbstractSchema<{ async: false, transformed: true, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

			implementSchemaClass(SimpleTransformedSchema, {
				isTransformed: () => true,
				validate: (value, { success }) => success(`${value} transformed`),
			})

			const transformedSchema = new SimpleTransformedSchema()
			const schema = array(transformedSchema)
			const result = await schema.validate(['test'])
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual(['test transformed'])
			}
		})
	})
})

describe('tests of `ArraySchema`', () => {
	describe('happy path cases', () => {
		it('case 1: Instantiate and validate', async () => {
			const schema = new ArraySchema({ meta: { item: string() } })
			const result = await schema.validate(['test'])
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual(['test'])
			}
		})
	})
})
