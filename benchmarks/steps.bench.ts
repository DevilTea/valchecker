import {
	array,
	check,
	createValchecker,
	endsWith,
	fallback,
	max,
	min,
	number,
	object,
	startsWith,
	string,
	toLowercase,
	toUppercase,
	transform,
} from '@valchecker/internal'
import { bench, describe } from 'vitest'

describe('steps - String Operations', () => {
	bench('string - basic validation', () => {
		const v = createValchecker({ steps: [string] })
		const schema = v.string()
		schema.execute('hello world')
	})

	bench('string - with startsWith', () => {
		const v = createValchecker({ steps: [string, startsWith] })
		const schema = v.string().startsWith('hello')
		schema.execute('hello world')
	})

	bench('string - with endsWith', () => {
		const v = createValchecker({ steps: [string, endsWith] })
		const schema = v.string().endsWith('world')
		schema.execute('hello world')
	})

	bench('string - toLowercase', () => {
		const v = createValchecker({ steps: [string, toLowercase] })
		const schema = v.string().toLowercase()
		schema.execute('HELLO WORLD')
	})

	bench('string - toUppercase', () => {
		const v = createValchecker({ steps: [string, toUppercase] })
		const schema = v.string().toUppercase()
		schema.execute('hello world')
	})

	bench('string - multiple transformations', () => {
		const v = createValchecker({ steps: [string, toLowercase, startsWith] })
		const schema = v.string()
			.toLowercase()
			.startsWith('hello')
		schema.execute('HELLO WORLD')
	})
})

describe('steps - Number Operations', () => {
	bench('number - basic validation', () => {
		const v = createValchecker({ steps: [number] })
		const schema = v.number()
		schema.execute(42)
	})

	bench('number - with min', () => {
		const v = createValchecker({ steps: [number, min] })
		const schema = v.number().min(0)
		schema.execute(42)
	})

	bench('number - with max', () => {
		const v = createValchecker({ steps: [number, max] })
		const schema = v.number().max(100)
		schema.execute(42)
	})

	bench('number - with min and max', () => {
		const v = createValchecker({ steps: [number, min, max] })
		const schema = v.number()
			.min(0)
			.max(100)
		schema.execute(42)
	})
})

describe('steps - Check Function', () => {
	bench('check - simple boolean', () => {
		const v = createValchecker({ steps: [string, check] })
		const schema = v.string().check(x => x.length > 3)
		schema.execute('hello')
	})

	bench('check - type guard', () => {
		const v = createValchecker({ steps: [string, check] })
		const schema = v.string().check((x): x is 'hello' => x === 'hello')
		schema.execute('hello')
	})

	bench('check - complex validation', () => {
		const v = createValchecker({ steps: [string, check] })
		const schema = v.string().check(x => x.length > 3 && x.includes('o'))
		schema.execute('hello')
	})

	bench('check - multiple checks', () => {
		const v = createValchecker({ steps: [string, check] })
		const schema = v.string()
			.check(x => x.length > 3)
			.check(x => x.includes('o'))
			.check(x => x.startsWith('h'))
		schema.execute('hello')
	})
})

describe('steps - Transform', () => {
	bench('transform - string to number', () => {
		const v = createValchecker({ steps: [string, transform] })
		const schema = v.string().transform(x => Number.parseInt(x, 10))
		schema.execute('42')
	})

	bench('transform - multiple transforms', () => {
		const v = createValchecker({ steps: [string, transform] })
		const schema = v.string()
			.transform(x => x.toUpperCase())
			.transform(x => x.split(''))
			.transform(x => x.length)
		schema.execute('hello')
	})

	bench('transform - with validation before and after', () => {
		const v = createValchecker({ steps: [string, check, transform] })
		const schema = v.string()
			.check(x => x.length > 0)
			.transform(x => Number.parseInt(x, 10))
			.check(x => x > 0)
		schema.execute('42')
	})
})

describe('steps - Fallback', () => {
	bench('fallback - success path (no fallback needed)', () => {
		const v = createValchecker({ steps: [string, fallback] })
		const schema = v.string().fallback('default')
		schema.execute('hello')
	})

	bench('fallback - failure path (fallback applied)', () => {
		const v = createValchecker({ steps: [string, fallback] })
		const schema = v.string().fallback('default')
		schema.execute(42)
	})
})

describe('steps - Array Operations', () => {
	bench('array - basic string array', () => {
		const v = createValchecker({ steps: [array, string] })
		const schema = v.array(v.string())
		schema.execute(['a', 'b', 'c', 'd', 'e'])
	})

	bench('array - with element validation', () => {
		const v = createValchecker({ steps: [array, string, check] })
		const schema = v.array(v.string().check(x => x.length > 0))
		schema.execute(['a', 'b', 'c', 'd', 'e'])
	})

	bench('array - with element transformation', () => {
		const v = createValchecker({ steps: [array, string, transform] })
		const schema = v.array(v.string().transform(x => x.toUpperCase()))
		schema.execute(['a', 'b', 'c', 'd', 'e'])
	})
})

describe('steps - Object Operations', () => {
	bench('object - simple 3 field object', () => {
		const v = createValchecker({ steps: [object, string, number] })
		const schema = v.object({
			name: v.string(),
			age: v.number(),
			email: v.string(),
		})
		schema.execute({ name: 'John', age: 30, email: 'john@example.com' })
	})

	bench('object - with field validations', () => {
		const v = createValchecker({ steps: [object, string, number, check] })
		const schema = v.object({
			name: v.string().check(x => x.length > 0),
			age: v.number().check(x => x > 0),
			email: v.string().check(x => x.includes('@')),
		})
		schema.execute({ name: 'John', age: 30, email: 'john@example.com' })
	})

	bench('object - with field transformations', () => {
		const v = createValchecker({ steps: [object, string, number, transform] })
		const schema = v.object({
			name: v.string().transform(x => x.toUpperCase()),
			age: v.number().transform(x => x * 2),
			email: v.string().transform(x => x.toLowerCase()),
		})
		schema.execute({ name: 'John', age: 30, email: 'JOHN@EXAMPLE.COM' })
	})
})

describe('steps - Chained Operations', () => {
	bench('string - 3 step chain', () => {
		const v = createValchecker({ steps: [string, toLowercase, startsWith] })
		const schema = v.string()
			.toLowercase()
			.startsWith('hello')
		schema.execute('HELLO WORLD')
	})

	bench('string - 5 step chain', () => {
		const v = createValchecker({ steps: [string, toLowercase, startsWith, check, transform] })
		const schema = v.string()
			.toLowercase()
			.startsWith('hello')
			.check(x => x.length > 5)
			.transform(x => x.split(' '))
		schema.execute('HELLO WORLD')
	})

	bench('number - 4 step chain', () => {
		const v = createValchecker({ steps: [number, min, max, check] })
		const schema = v.number()
			.min(0)
			.max(100)
			.check(x => x % 2 === 0)
		schema.execute(42)
	})
})
