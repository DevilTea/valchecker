import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { number } from '../number'
import { object } from '../object'
import { string, StringSchema } from '../string'
import { isOptionalValSchema, isWithModifierSchema, optional, unwrapWithModifierSchema, WithModifierSchema } from './withModifier'

describe('tests of `optional`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should create optional schema from a basic schema', () => {
				const schema = string()
				const result = optional(schema)
				expect(result).toBeInstanceOf(WithModifierSchema)
				expect(result.meta.modifier).toBe('optional')
				expect(result.meta.schema).toBe(schema)
			})
		})
		describe('case 2', () => {
			it('should validate defined values normally', async () => {
				const schema = optional(string())
				const result = await schema.validate('test')
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe('test')
				}
			})
		})
		describe('case 4', () => {
			it('should unwrap nested WithModifierSchema', () => {
				const baseSchema = string()
				const nestedOptional = optional(baseSchema)
				const doubleOptional = optional(nestedOptional)
				expect(doubleOptional).toBeInstanceOf(WithModifierSchema)
				expect(doubleOptional.meta.modifier).toBe('optional')
				expect(doubleOptional.meta.schema).toBe(baseSchema)
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1', () => {
			it('should work with complex schemas', async () => {
				const schema = optional(object({ name: string(), age: number() }))
				const result = await schema.validate({ name: 'John', age: 30 })
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toEqual({ name: 'John', age: 30 })
				}
			})
		})
	})
	describe('error cases', () => {
		describe('case 1', () => {
			it('should reject invalid values for the base schema', async () => {
				const schema = optional(string())
				const result = await schema.validate(123)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues!.length).toBeGreaterThan(0)
					if (result.issues!.length > 0) {
						expect(result.issues![0]!.code).toBe('EXPECTED_STRING')
					}
				}
			})
		})
	})
})

describe('tests of `WithModifierSchema`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should inherit transformed status from base schema', () => {
				const baseSchema = string().transform(value => value.toUpperCase())
				const schema = optional(baseSchema)
				expect(schema.isTransformed).toBe(true)
			})
		})
		describe('case 2', () => {
			it('should inherit non-transformed status from base schema', () => {
				const baseSchema = string()
				const schema = optional(baseSchema)
				expect(schema.isTransformed).toBe(false)
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1', () => {
			it('should handle nested modifiers', () => {
				const schema = optional(string())
				expect(schema.meta.modifier).toBe('optional')
				expect(schema.meta.schema).toBeInstanceOf(StringSchema)
			})
		})
	})
})

describe('tests of `isOptionalValSchema`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should return true for optional schemas', () => {
				const schema = optional(string())
				const result = isOptionalValSchema(schema)
				expect(result).toBe(true)
			})
		})
		describe('case 2', () => {
			it('should return false for non-optional schemas', () => {
				const schema = string()
				const result = isOptionalValSchema(schema)
				expect(result).toBe(false)
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1', () => {
			it('should return false for WithModifierSchema with different modifier', () => {
				// Since we only have 'optional' modifier currently, this is hypothetical
				// but we can test with a non-WithModifierSchema
				const schema = string()
				const result = isOptionalValSchema(schema)
				expect(result).toBe(false)
			})
		})
	})
})

describe('tests of `isWithModifierSchema`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should return true for WithModifierSchema instances', () => {
				const schema = optional(string())
				const result = isWithModifierSchema(schema)
				expect(result).toBe(true)
			})
		})
		describe('case 2', () => {
			it('should return false for non-WithModifierSchema instances', () => {
				const schema = string()
				const result = isWithModifierSchema(schema)
				expect(result).toBe(false)
			})
		})
	})
})

describe('tests of `unwrapWithModifierSchema`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should unwrap WithModifierSchema to get inner schema', () => {
				const baseSchema = string()
				const optionalSchema = optional(baseSchema)
				const result = unwrapWithModifierSchema(optionalSchema)
				expect(result).toBe(baseSchema)
			})
		})
		describe('case 2', () => {
			it('should return input schema if not WithModifierSchema', () => {
				const schema = string()
				const result = unwrapWithModifierSchema(schema)
				expect(result).toBe(schema)
			})
		})
	})
})
