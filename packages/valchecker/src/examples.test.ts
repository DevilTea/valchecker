import { describe, expect, it } from 'vitest'
import * as v from '.'

// Common schema examples using valchecker

describe('common schema examples', () => {
	describe('string schema', () => {
		const stringSchema = v.string()

		it('should validate a valid string', () => {
			const result = v.execute(stringSchema, 'hello')
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe('hello')
			}
		})

		it('should reject a number', () => {
			const result = v.execute(stringSchema, 123)
			expect(v.isSuccess(result)).toBe(false)
			if (!v.isSuccess(result)) {
				expect(result.issues.length).toBeGreaterThan(0)
				expect(result.issues[0]!.code).toBe('EXPECTED_STRING')
			}
		})

		it('should be valid for string input', () => {
			expect(v.isValid(stringSchema, 'test')).toBe(true)
		})

		it('should be invalid for non-string input', () => {
			expect(v.isValid(stringSchema, 42)).toBe(false)
		})
	})

	describe('number schema', () => {
		const numberSchema = v.number()

		it('should validate a valid number', () => {
			const result = v.execute(numberSchema, 42)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe(42)
			}
		})

		it('should reject NaN by default', () => {
			const result = v.execute(numberSchema, Number.NaN)
			expect(v.isSuccess(result)).toBe(false)
		})

		it('should allow NaN when configured', () => {
			const numberWithNaNSchema = v.number(true)
			const result = v.execute(numberWithNaNSchema, Number.NaN)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe(Number.NaN)
			}
		})

		it('should reject a string', () => {
			const result = v.execute(numberSchema, '123')
			expect(v.isSuccess(result)).toBe(false)
		})
	})

	describe('boolean schema', () => {
		const booleanSchema = v.boolean()

		it('should validate true', () => {
			const result = v.execute(booleanSchema, true)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe(true)
			}
		})

		it('should validate false', () => {
			const result = v.execute(booleanSchema, false)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe(false)
			}
		})

		it('should reject a string', () => {
			const result = v.execute(booleanSchema, 'true')
			expect(v.isSuccess(result)).toBe(false)
		})
	})

	describe('array schema', () => {
		const stringArraySchema = v.array(v.string())

		it('should validate an array of strings', () => {
			const result = v.execute(stringArraySchema, ['a', 'b', 'c'])
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toEqual(['a', 'b', 'c'])
			}
		})

		it('should reject an array with non-string elements', () => {
			const result = v.execute(stringArraySchema, ['a', 1, 'c'])
			expect(v.isSuccess(result)).toBe(false)
		})

		it('should reject a non-array', () => {
			const result = v.execute(stringArraySchema, 'not an array')
			expect(v.isSuccess(result)).toBe(false)
		})
	})

	describe('object schema', () => {
		const userSchema = v.object({
			name: v.string(),
			age: v.number(),
			isActive: v.boolean(),
		})

		it('should validate a valid object', () => {
			const validUser = {
				name: 'John Doe',
				age: 30,
				isActive: true,
			}
			const result = v.execute(userSchema, validUser)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toEqual(validUser)
			}
		})

		it('should reject an object with missing properties', () => {
			const invalidUser = {
				name: 'John Doe',
				// missing age and isActive
			}
			const result = v.execute(userSchema, invalidUser)
			expect(v.isSuccess(result)).toBe(false)
		})

		it('should reject an object with invalid property types', () => {
			const invalidUser = {
				name: 'John Doe',
				age: 'thirty', // should be number
				isActive: true,
			}
			const result = v.execute(userSchema, invalidUser)
			expect(v.isSuccess(result)).toBe(false)
		})
	})

	describe('literal schema', () => {
		const statusSchema = v.literal('active')

		it('should validate the exact literal value', () => {
			const result = v.execute(statusSchema, 'active')
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe('active')
			}
		})

		it('should reject different values', () => {
			const result = v.execute(statusSchema, 'inactive')
			expect(v.isSuccess(result)).toBe(false)
		})

		it('should reject different types', () => {
			const result = v.execute(statusSchema, 1)
			expect(v.isSuccess(result)).toBe(false)
		})
	})

	describe('union schema', () => {
		const stringOrNumberSchema = v.union(v.string(), v.number())

		it('should validate a string', () => {
			const result = v.execute(stringOrNumberSchema, 'hello')
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe('hello')
			}
		})

		it('should validate a number', () => {
			const result = v.execute(stringOrNumberSchema, 42)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe(42)
			}
		})

		it('should reject a boolean', () => {
			const result = v.execute(stringOrNumberSchema, true)
			expect(v.isSuccess(result)).toBe(false)
		})
	})

	describe('optional schema', () => {
		const optionalStringSchema = v.optional(v.string())

		it('should validate a string', () => {
			const result = v.execute(optionalStringSchema, 'hello')
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe('hello')
			}
		})

		it('should validate undefined', () => {
			const result = v.execute(optionalStringSchema, undefined)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBeUndefined()
			}
		})

		it('should reject a number', () => {
			const result = v.execute(optionalStringSchema, 123)
			expect(v.isSuccess(result)).toBe(false)
		})
	})

	describe('complex example: user registration', () => {
		const registrationSchema = v.object({
			username: v.string(),
			email: v.string(), // In a real app, you'd have email validation
			password: v.string(),
			age: v.optional(v.number()),
			newsletter: v.boolean(),
		})

		it('should validate a complete registration', () => {
			const registration = {
				username: 'johndoe',
				email: 'john@example.com',
				password: 'secret123',
				age: 25,
				newsletter: true,
			}
			const result = v.execute(registrationSchema, registration)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toEqual(registration)
			}
		})

		it('should validate registration without optional age', () => {
			const registration = {
				username: 'johndoe',
				email: 'john@example.com',
				password: 'secret123',
				newsletter: false,
			}
			const result = v.execute(registrationSchema, registration)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toEqual(registration)
			}
		})

		it('should reject invalid registration', () => {
			const invalidRegistration = {
				username: 123, // should be string
				email: 'john@example.com',
				password: 'secret123',
				newsletter: 'yes', // should be boolean
			}
			const result = v.execute(registrationSchema, invalidRegistration)
			expect(v.isSuccess(result)).toBe(false)
		})
	})
})

describe('pipe examples', () => {
	describe('check: custom validation', () => {
		const emailSchema = v.pipe(v.string())
			.check(value => value.includes('@'), 'Must contain @ symbol')
			.check(value => value.includes('.'), 'Must contain dot')
			.check(value => value.length >= 6, 'Must be at least 6 characters')

		it('should validate a valid email', () => {
			const result = v.execute(emailSchema, 'user@example.com')
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe('user@example.com')
			}
		})

		it('should reject email without @', () => {
			const result = v.execute(emailSchema, 'userexample.com')
			expect(v.isSuccess(result)).toBe(false)
		})

		it('should reject email without dot', () => {
			const result = v.execute(emailSchema, 'user@example')
			expect(v.isSuccess(result)).toBe(false)
		})

		it('should reject short email', () => {
			const result = v.execute(emailSchema, 'a@b.c')
			expect(v.isSuccess(result)).toBe(false)
		})
	})

	describe('check: type narrowing', () => {
		const startsWithPrefixSchema = v.pipe(v.string())
			.check((value, { narrow }) => value.startsWith('prefix_') ? narrow<`prefix_${string}`>() : false, 'Must start with "prefix_"')

		it('should validate string with correct prefix', () => {
			const result = v.execute(startsWithPrefixSchema, 'prefix_value')
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe('prefix_value')
				// TypeScript should infer result.value as `prefix_${string}` here
			}
		})

		const startsWithPrefixSchemaTypeGuard = v.pipe(v.string())
			.check((value): value is `prefix_${string}` => value.startsWith('prefix_'), 'Must start with "prefix_"')

		it('should validate string with correct prefix (type guard)', () => {
			const result = v.execute(startsWithPrefixSchemaTypeGuard, 'prefix_value')
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe('prefix_value')
				// TypeScript should infer result.value as `prefix_${string}` here
			}
		})

		const asyncStartsWithPrefixSchema = v.pipe(v.string())
			.check(async (value, { narrow }) => {
				await new Promise(resolve => setTimeout(resolve, 10)) // simulate async work
				return value.startsWith('prefix_') ? narrow<`prefix_${string}`>() : false
			}, 'Must start with "prefix_"')

		it('should validate string with correct prefix asynchronously', async () => {
			const result = await v.execute(asyncStartsWithPrefixSchema, 'prefix_value')
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe('prefix_value')
				// TypeScript should infer result.value as `prefix_${string}` here
			}
		})
	})

	describe('transform: data transformation', () => {
		const ageSchema = v.pipe(v.number())
			.check(value => value >= 0, 'Age must be non-negative')
			.check(value => value <= 150, 'Age must be realistic')
			.transform(value => ({ age: value, isAdult: value >= 18 }))

		it('should transform valid age to object', () => {
			const result = v.execute(ageSchema, 25)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toEqual({ age: 25, isAdult: true })
			}
		})

		it('should transform child age', () => {
			const result = v.execute(ageSchema, 15)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toEqual({ age: 15, isAdult: false })
			}
		})

		it('should reject negative age', () => {
			const result = v.execute(ageSchema, -5)
			expect(v.isSuccess(result)).toBe(false)
		})

		it('should reject unrealistic age', () => {
			const result = v.execute(ageSchema, 200)
			expect(v.isSuccess(result)).toBe(false)
		})
	})

	describe('transform: string processing', () => {
		const usernameSchema = v.pipe(v.string())
			.transform(value => value.trim())
			.check(value => value.length >= 3, 'Username must be at least 3 characters')
			.check(value => value.length <= 20, 'Username must be at most 20 characters')
			.check(value => /^\w+$/.test(value), 'Username can only contain letters, numbers, and underscores')
			.transform(value => value.toLowerCase())

		it('should process and validate username', () => {
			const result = v.execute(usernameSchema, '  John_Doe123  ')
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe('john_doe123')
			}
		})

		it('should reject short username', () => {
			const result = v.execute(usernameSchema, 'ab')
			expect(v.isSuccess(result)).toBe(false)
		})

		it('should reject username with invalid characters', () => {
			const result = v.execute(usernameSchema, 'john-doe!')
			expect(v.isSuccess(result)).toBe(false)
		})
	})

	describe('fallback: error recovery', () => {
		const robustNumberSchema = v.pipe(v.number())
			.check(value => value >= 0, 'Must be non-negative')
			.fallback(() => 0) // If validation fails, default to 0

		it('should parse valid number', () => {
			const result = v.execute(robustNumberSchema, 42)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe(42)
			}
		})

		it('should fallback to 0 for invalid input', () => {
			const result = v.execute(robustNumberSchema, -5) // This will fail the check and trigger fallback
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe(0)
			}
		})
	})

	describe('complex pipe: user profile processing', () => {
		const userProfileSchema = v.pipe(v.object({
			name: v.string(),
			email: v.string(),
			age: v.number(),
			score: v.optional(v.number()),
		}))
			.check(user => user.age >= 13, 'Must be at least 13 years old')
			.transform(user => ({
				...user,
				email: user.email.toLowerCase().trim(),
				score: user.score ?? 0,
				level: user.age >= 18 ? 'adult' : 'teen',
			}))
			.check(user => user.score >= 0 && user.score <= 100, 'Score must be between 0 and 100')
			.transform((user) => {
				let rank: string
				if (user.score >= 90) {
					rank = 'expert'
				}
				else if (user.score >= 70) {
					rank = 'advanced'
				}
				else if (user.score >= 50) {
					rank = 'intermediate'
				}
				else {
					rank = 'beginner'
				}
				return {
					...user,
					rank,
				}
			})

		it('should process complete adult profile', () => {
			const input = {
				name: 'Alice Johnson',
				email: 'ALICE@EXAMPLE.COM',
				age: 25,
				score: 85,
			}
			const result = v.execute(userProfileSchema, input)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toEqual({
					name: 'Alice Johnson',
					email: 'alice@example.com',
					age: 25,
					score: 85,
					level: 'adult',
					rank: 'advanced',
				})
			}
		})

		it('should process teen profile with default score', () => {
			const input = {
				name: 'Bob Smith',
				email: ' bob@example.com ',
				age: 15,
				// score is optional
			}
			const result = v.execute(userProfileSchema, input)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toEqual({
					name: 'Bob Smith',
					email: 'bob@example.com',
					age: 15,
					score: 0,
					level: 'teen',
					rank: 'beginner',
				})
			}
		})

		it('should reject underage user', () => {
			const input = {
				name: 'Charlie Brown',
				email: 'charlie@example.com',
				age: 10,
				score: 50,
			}
			const result = v.execute(userProfileSchema, input)
			expect(v.isSuccess(result)).toBe(false)
		})

		it('should reject invalid score', () => {
			const input = {
				name: 'Diana Prince',
				email: 'diana@example.com',
				age: 30,
				score: 150, // invalid score
			}
			const result = v.execute(userProfileSchema, input)
			expect(v.isSuccess(result)).toBe(false)
		})
	})

	describe('pipe with run: chaining schemas', () => {
		const baseStringSchema = v.string()
		const enhancedStringSchema = v.pipe(baseStringSchema)
			.run(v.pipe(v.string()).check(value => value.length > 0, 'String cannot be empty'))
			.transform(value => value.toUpperCase())

		it('should chain schemas successfully', () => {
			const result = v.execute(enhancedStringSchema, 'hello')
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe('HELLO')
			}
		})

		it('should fail on empty string', () => {
			const result = v.execute(enhancedStringSchema, '')
			expect(v.isSuccess(result)).toBe(false)
		})

		it('should fail on non-string input', () => {
			const result = v.execute(enhancedStringSchema, 123)
			expect(v.isSuccess(result)).toBe(false)
		})
	})

	describe('transform: async data transformation', () => {
		const asyncUserSchema = v.pipe(v.object({
			name: v.string(),
			email: v.string(),
		}))
			.transform(async (user) => {
				// Simulate async operation like fetching user ID from database
				await new Promise(resolve => setTimeout(resolve, 10))
				return {
					...user,
					id: `user_${Date.now()}`,
					email: user.email.toLowerCase(),
				}
			})

		it('should asynchronously transform user data', async () => {
			const input = {
				name: 'John Doe',
				email: 'JOHN@EXAMPLE.COM',
			}
			const result = await v.execute(asyncUserSchema, input)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value.name).toBe('John Doe')
				expect(result.value.email).toBe('john@example.com')
				expect(result.value.id).toMatch(/^user_\d+$/)
			}
		})

		it('should reject invalid input before async transform', async () => {
			const input = {
				name: 'John Doe',
				email: 123, // invalid email type
			}
			const result = await v.execute(asyncUserSchema, input)
			expect(v.isSuccess(result)).toBe(false)
		})
	})

	describe('fallback: async error recovery', () => {
		const asyncRobustNumberSchema = v.pipe(v.number())
			.check(value => value >= 0, 'Must be non-negative')
			.fallback(async () => {
				// Simulate async fallback like fetching default value from config
				await new Promise(resolve => setTimeout(resolve, 10))
				return 42 // default value
			})

		it('should parse valid number without fallback', async () => {
			const result = await v.execute(asyncRobustNumberSchema, 100)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe(100)
			}
		})

		it('should asynchronously fallback for invalid input', async () => {
			const result = await v.execute(asyncRobustNumberSchema, -5)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe(42)
			}
		})

		it('should reject non-number input before fallback', async () => {
			const result = await v.execute(asyncRobustNumberSchema, 'not a number')
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				expect(result.value).toBe(42) // fallback value
			}
		})
	})
})
