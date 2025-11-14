import { array, boolean, check, createValchecker, literal, number, object, string, union } from '@valchecker/internal'
import { bench, describe } from 'vitest'

describe('core - createValchecker', () => {
	bench('createValchecker - basic string schema', () => {
		const v = createValchecker({ steps: [string] })
		const schema = v.string()
		schema.execute('hello')
	})

	bench('createValchecker - string with validation', () => {
		const v = createValchecker({ steps: [string, check] })
		const schema = v.string().check(x => x.length > 3)
		schema.execute('hello')
	})

	bench('createValchecker - number schema', () => {
		const v = createValchecker({ steps: [number] })
		const schema = v.number()
		schema.execute(42)
	})

	bench('createValchecker - boolean schema', () => {
		const v = createValchecker({ steps: [boolean] })
		const schema = v.boolean()
		schema.execute(true)
	})
})

describe('core - Simple Objects', () => {
	bench('simple object - 3 properties', () => {
		const v = createValchecker({ steps: [object, string, number, boolean] })
		const schema = v.object({
			name: v.string(),
			age: v.number(),
			active: v.boolean(),
		})
		schema.execute({ name: 'John', age: 30, active: true })
	})

	bench('simple object - 5 properties', () => {
		const v = createValchecker({ steps: [object, string, number, boolean] })
		const schema = v.object({
			name: v.string(),
			age: v.number(),
			active: v.boolean(),
			email: v.string(),
			score: v.number(),
		})
		schema.execute({ name: 'John', age: 30, active: true, email: 'john@example.com', score: 100 })
	})

	bench('simple object - 10 properties', () => {
		const v = createValchecker({ steps: [object, string, number, boolean] })
		const schema = v.object({
			name: v.string(),
			age: v.number(),
			active: v.boolean(),
			email: v.string(),
			score: v.number(),
			field1: v.string(),
			field2: v.number(),
			field3: v.boolean(),
			field4: v.string(),
			field5: v.number(),
		})
		schema.execute({
			name: 'John',
			age: 30,
			active: true,
			email: 'john@example.com',
			score: 100,
			field1: 'value1',
			field2: 42,
			field3: false,
			field4: 'value4',
			field5: 99,
		})
	})
})

describe('core - Nested Objects', () => {
	bench('nested object - 2 levels', () => {
		const v = createValchecker({ steps: [object, string, number] })
		const schema = v.object({
			name: v.string(),
			address: v.object({
				street: v.string(),
				city: v.string(),
			}),
		})
		schema.execute({
			name: 'John',
			address: { street: '123 Main St', city: 'New York' },
		})
	})

	bench('nested object - 3 levels', () => {
		const v = createValchecker({ steps: [object, string, number] })
		const schema = v.object({
			name: v.string(),
			address: v.object({
				street: v.string(),
				city: v.string(),
				country: v.object({
					name: v.string(),
					code: v.string(),
				}),
			}),
		})
		schema.execute({
			name: 'John',
			address: {
				street: '123 Main St',
				city: 'New York',
				country: { name: 'USA', code: 'US' },
			},
		})
	})
})

describe('core - Arrays', () => {
	bench('array - 10 strings', () => {
		const v = createValchecker({ steps: [array, string] })
		const schema = v.array(v.string())
		schema.execute(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])
	})

	bench('array - 50 numbers', () => {
		const v = createValchecker({ steps: [array, number] })
		const schema = v.array(v.number())
		const data = Array.from({ length: 50 }, (_, i) => i)
		schema.execute(data)
	})

	bench('array - 100 objects', () => {
		const v = createValchecker({ steps: [array, object, string, number] })
		const schema = v.array(v.object({
			id: v.number(),
			name: v.string(),
		}))
		const data = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item${i}` }))
		schema.execute(data)
	})
})

describe('core - Union Types', () => {
	bench('union - 2 types (string | number)', () => {
		const v = createValchecker({ steps: [union, string, number] })
		const schema = v.union([v.string(), v.number()])
		schema.execute('hello')
	})

	bench('union - 3 types', () => {
		const v = createValchecker({ steps: [union, string, number, boolean] })
		const schema = v.union([v.string(), v.number(), v.boolean()])
		schema.execute(42)
	})

	bench('union - 5 literal types', () => {
		const v = createValchecker({ steps: [union, literal] })
		const schema = v.union([
			v.literal('a'),
			v.literal('b'),
			v.literal('c'),
			v.literal('d'),
			v.literal('e'),
		])
		schema.execute('c')
	})
})

describe('core - Complex Scenarios', () => {
	bench('complex - user profile', () => {
		const v = createValchecker({ steps: [object, string, number, boolean, array, union, literal] })
		const schema = v.object({
			id: v.number(),
			username: v.string(),
			email: v.string(),
			age: v.number(),
			isActive: v.boolean(),
			roles: v.array(v.string()),
			status: v.union([v.literal('active'), v.literal('inactive'), v.literal('pending')]),
			profile: v.object({
				firstName: v.string(),
				lastName: v.string(),
				bio: v.string(),
			}),
		})
		schema.execute({
			id: 1,
			username: 'johndoe',
			email: 'john@example.com',
			age: 30,
			isActive: true,
			roles: ['user', 'admin'],
			status: 'active',
			profile: {
				firstName: 'John',
				lastName: 'Doe',
				bio: 'Software developer',
			},
		})
	})

	bench('complex - nested array of objects', () => {
		const v = createValchecker({ steps: [array, object, string, number] })
		const schema = v.array(v.object({
			id: v.number(),
			items: v.array(v.object({
				name: v.string(),
				value: v.number(),
			})),
		}))
		const data = Array.from({ length: 10 }, (_, i) => ({
			id: i,
			items: Array.from({ length: 5 }, (_, j) => ({
				name: `item${j}`,
				value: j * 10,
			})),
		}))
		schema.execute(data)
	})
})

describe('core - Validation Failures', () => {
	bench('validation failure - string type mismatch', () => {
		const v = createValchecker({ steps: [string] })
		const schema = v.string()
		schema.execute(42)
	})

	bench('validation failure - object missing required field', () => {
		const v = createValchecker({ steps: [object, string, number] })
		const schema = v.object({
			name: v.string(),
			age: v.number(),
		})
		schema.execute({ name: 'John' })
	})

	bench('validation failure - union no match', () => {
		const v = createValchecker({ steps: [union, string, number] })
		const schema = v.union([v.string(), v.number()])
		schema.execute(true)
	})
})
