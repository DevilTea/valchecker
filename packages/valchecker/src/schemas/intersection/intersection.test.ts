import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { number } from '../number'
import { string } from '../string'
import { intersection, IntersectionSchema } from './intersection'

describe('tests of `intersection`', () => {
	describe('happy path cases', () => {
		it('case 1: Create intersection schema', () => {
			const schema = intersection(string(), number())
			expect(schema).toBeInstanceOf(IntersectionSchema)
		})
	})

	describe('edge cases', () => {
		it('case 1: Validate value that passes all branches', async () => {
			// Use two identical schemas for a valid intersection
			const stringSchema1 = string()
			const stringSchema2 = string()
			const schema = intersection(stringSchema1, stringSchema2)
			const result = await schema.validate('test')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('test')
			}
		})

		it('case 2: Validate value that fails some branches', async () => {
			const stringSchema = string()
			const numberSchema = number()
			const schema = intersection(stringSchema, numberSchema)
			const result = await schema.validate('test')
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected number.')
			}
		})

		it('case 3: Validate value that fails all branches', async () => {
			const stringSchema = string()
			const numberSchema = number()
			const schema = intersection(stringSchema, numberSchema)
			const result = await schema.validate(true)
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1) // Only first failure due to early return optimization
				expect(result.issues[0]!.message).toBe('Expected string.')
			}
		})
	})
})

describe('tests of `IntersectionSchema`', () => {
	describe('happy path cases', () => {
		it('case 1: Instantiate and validate', async () => {
			const schema = new IntersectionSchema({ meta: { branches: [string(), string()] } })
			const result = await schema.validate('test')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('test')
			}
		})
	})
})
