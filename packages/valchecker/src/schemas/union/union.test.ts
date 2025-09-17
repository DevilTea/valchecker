import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { boolean } from '../boolean'
import { number } from '../number'
import { string } from '../string'
import { union, UnionSchema } from './union'

describe('tests of `union`', () => {
	describe('happy path cases', () => {
		it('case 1: Create union schema', () => {
			const schema = union(string(), number())
			expect(schema).toBeInstanceOf(UnionSchema)
		})
	})

	describe('edge cases', () => {
		it('case 1: Validate value that passes first branch', async () => {
			const schema = union(string(), number())
			const result = await schema.execute('test')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('test')
			}
		})

		it('case 2: Validate value that passes second branch', async () => {
			const schema = union(string(), number())
			const result = await schema.execute(42)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe(42)
			}
		})

		it('case 3: Validate value that fails all branches', async () => {
			const schema = union(string(), number())
			const result = await schema.execute(true)
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(2)
				expect(result.issues[0]!.message).toBe('Expected string.')
				expect(result.issues[1]!.message).toBe('Expected number.')
			}
		})

		it('case 4: Validate with three branches - passes middle branch', async () => {
			const schema = union(string(), number(), string()) // string | number | string
			const result = await schema.execute(42)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe(42)
			}
		})

		it('case 6: Validate with multiple branches - early return on first success', async () => {
			const schema = union(string(), number(), string()) // string | number | string
			const result = await schema.execute('test')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('test')
			}
		})

		it('case 7: Validate with multiple branches - early return on second success', async () => {
			const schema = union(number(), string(), number()) // number | string | number
			const result = await schema.execute('test')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('test')
			}
		})

		it('case 8: Validate with three branches - early return after second branch success', async () => {
			const schema = union(number(), string(), boolean()) // number | string | boolean
			const result = await schema.execute('test')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('test')
			}
		})
	})
})

describe('tests of `UnionSchema`', () => {
	describe('happy path cases', () => {
		it('case 1: Instantiate and validate', async () => {
			const schema = new UnionSchema({ meta: { branches: [string(), number()] } })
			const result = await schema.execute('test')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('test')
			}
		})
	})
})
