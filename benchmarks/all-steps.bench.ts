/**
 * Comprehensive benchmark tests for all valchecker steps
 * Each step should have at least one benchmark to measure its performance
 */

import {
	any,
	array,
	as,
	bigint,
	boolean,
	check,
	createValchecker,
	empty,
	endsWith,
	fallback,
	generic,
	instance,
	integer,
	intersection,
	json,
	literal,
	looseNumber,
	looseObject,
	max,
	min,
	never,
	null as null_,
	number,
	object,
	parseJSON,
	startsWith,
	strictObject,
	string,
	stringifyJSON,
	symbol,
	toFiltered,
	toLength,
	toLowercase,
	toSliced,
	toSorted,
	toSplitted,
	toString,
	toTrimmed,
	toTrimmedEnd,
	toTrimmedStart,
	toUppercase,
	transform,
	undefined as undefined_,
	union,
	unknown,
	use,
} from '@valchecker/internal'
import { bench, describe } from 'vitest'

// Type validators
describe('type Validators', () => {
	bench('any - basic validation', () => {
		const v = createValchecker({ steps: [any] })
		const schema = v.any()
		schema.execute('anything')
	})

	bench('unknown - basic validation', () => {
		const v = createValchecker({ steps: [unknown] })
		const schema = v.unknown()
		schema.execute('anything')
	})

	bench('never - validation', () => {
		const v = createValchecker({ steps: [never] })
		const schema = v.never()
		schema.execute(undefined)
	})

	bench('string - basic validation', () => {
		const v = createValchecker({ steps: [string] })
		const schema = v.string()
		schema.execute('hello world')
	})

	bench('number - basic validation', () => {
		const v = createValchecker({ steps: [number] })
		const schema = v.number()
		schema.execute(42)
	})

	bench('boolean - basic validation', () => {
		const v = createValchecker({ steps: [boolean] })
		const schema = v.boolean()
		schema.execute(true)
	})

	bench('bigint - basic validation', () => {
		const v = createValchecker({ steps: [bigint] })
		const schema = v.bigint()
		schema.execute(9007199254740991n)
	})

	bench('symbol - basic validation', () => {
		const v = createValchecker({ steps: [symbol] })
		const schema = v.symbol()
		schema.execute(Symbol('test'))
	})

	bench('null - basic validation', () => {
		const v = createValchecker({ steps: [null_] })
		const schema = v.null()
		schema.execute(null)
	})

	bench('undefined - basic validation', () => {
		const v = createValchecker({ steps: [undefined_] })
		const schema = v.undefined()
		schema.execute(undefined)
	})
})

// Numeric constraints
describe('numeric Constraints', () => {
	bench('integer - validation', () => {
		const v = createValchecker({ steps: [number, integer] })
		const schema = v.number().integer()
		schema.execute(42)
	})

	bench('min - number constraint', () => {
		const v = createValchecker({ steps: [number, min] })
		const schema = v.number().min(0)
		schema.execute(42)
	})

	bench('max - number constraint', () => {
		const v = createValchecker({ steps: [number, max] })
		const schema = v.number().max(100)
		schema.execute(42)
	})

	bench('looseNumber - string to number', () => {
		const v = createValchecker({ steps: [looseNumber] })
		const schema = v.looseNumber()
		schema.execute('42')
	})
})

// String operations
describe('string Operations', () => {
	bench('startsWith - validation', () => {
		const v = createValchecker({ steps: [string, startsWith] })
		const schema = v.string().startsWith('hello')
		schema.execute('hello world')
	})

	bench('endsWith - validation', () => {
		const v = createValchecker({ steps: [string, endsWith] })
		const schema = v.string().endsWith('world')
		schema.execute('hello world')
	})

	bench('toLowercase - transformation', () => {
		const v = createValchecker({ steps: [string, toLowercase] })
		const schema = v.string().toLowercase()
		schema.execute('HELLO WORLD')
	})

	bench('toUppercase - transformation', () => {
		const v = createValchecker({ steps: [string, toUppercase] })
		const schema = v.string().toUppercase()
		schema.execute('hello world')
	})

	bench('toTrimmed - transformation', () => {
		const v = createValchecker({ steps: [string, toTrimmed] })
		const schema = v.string().toTrimmed()
		schema.execute('  hello world  ')
	})

	bench('toTrimmedStart - transformation', () => {
		const v = createValchecker({ steps: [string, toTrimmedStart] })
		const schema = v.string().toTrimmedStart()
		schema.execute('  hello world')
	})

	bench('toTrimmedEnd - transformation', () => {
		const v = createValchecker({ steps: [string, toTrimmedEnd] })
		const schema = v.string().toTrimmedEnd()
		schema.execute('hello world  ')
	})

	bench('toLength - transformation', () => {
		const v = createValchecker({ steps: [string, toLength] })
		const schema = v.string().toLength()
		schema.execute('hello')
	})

	bench('toSplitted - transformation', () => {
		const v = createValchecker({ steps: [string, toSplitted] })
		const schema = v.string().toSplitted(' ')
		schema.execute('hello world')
	})

	bench('toString - type conversion', () => {
		const v = createValchecker({ steps: [number, toString] })
		const schema = v.number().toString()
		schema.execute(42)
	})
})

// Array operations
describe('array Operations', () => {
	bench('array - basic validation', () => {
		const v = createValchecker({ steps: [array, string] })
		const schema = v.array(v.string())
		schema.execute(['a', 'b', 'c'])
	})

	bench('toFiltered - filter array', () => {
		const v = createValchecker({ steps: [array, number, toFiltered] })
		const schema = v.array(v.number()).toFiltered(x => x > 5)
		schema.execute([1, 6, 3, 8, 2, 9])
	})

	bench('toSorted - sort array', () => {
		const v = createValchecker({ steps: [array, number, toSorted] })
		const schema = v.array(v.number()).toSorted((a, b) => a - b)
		schema.execute([3, 1, 4, 1, 5, 9, 2, 6])
	})

	bench('toSliced - slice array', () => {
		const v = createValchecker({ steps: [array, number, toSliced] })
		const schema = v.array(v.number()).toSliced(0, 3)
		schema.execute([1, 2, 3, 4, 5])
	})
})

// Object operations
describe('object Operations', () => {
	bench('object - basic validation', () => {
		const v = createValchecker({ steps: [object, string, number] })
		const schema = v.object({
			name: v.string(),
			age: v.number(),
		})
		schema.execute({ name: 'John', age: 30 })
	})

	bench('strictObject - strict validation', () => {
		const v = createValchecker({ steps: [strictObject, string, number] })
		const schema = v.strictObject({
			name: v.string(),
			age: v.number(),
		})
		schema.execute({ name: 'John', age: 30 })
	})

	bench('looseObject - loose validation', () => {
		const v = createValchecker({ steps: [looseObject, string] })
		const schema = v.looseObject({
			name: v.string(),
		})
		schema.execute({ name: 'John', extra: 'allowed' })
	})
})

// Composition
describe('composition', () => {
	bench('union - 2 types', () => {
		const v = createValchecker({ steps: [union, string, number] })
		const schema = v.union([v.string(), v.number()])
		schema.execute('hello')
	})

	bench('intersection - 2 types', () => {
		const v = createValchecker({ steps: [intersection, object, string] })
		const schema = v.intersection([
			v.object({ name: v.string() }),
			v.object({ age: v.number() }),
		])
		schema.execute({ name: 'John', age: 30 })
	})

	bench('literal - string literal', () => {
		const v = createValchecker({ steps: [literal] })
		const schema = v.literal('hello')
		schema.execute('hello')
	})

	bench('use - reuse schema', () => {
		const v = createValchecker({ steps: [string, use] })
		const emailSchema = v.string()
		const schema = v.unknown().use(emailSchema)
		schema.execute('test@example.com')
	})
})

// Advanced operations
describe('advanced Operations', () => {
	bench('check - custom validation', () => {
		const v = createValchecker({ steps: [string, check] })
		const schema = v.string().check(x => x.length > 3)
		schema.execute('hello')
	})

	bench('transform - custom transformation', () => {
		const v = createValchecker({ steps: [string, transform] })
		const schema = v.string().transform(x => x.toUpperCase())
		schema.execute('hello')
	})

	bench('fallback - with fallback', () => {
		const v = createValchecker({ steps: [string, fallback] })
		const schema = v.string().fallback('default')
		schema.execute('hello')
	})

	bench('as - type assertion', () => {
		const v = createValchecker({ steps: [string, as] })
		const schema = v.string().as<'hello'>()
		schema.execute('hello')
	})

	bench('empty - empty check', () => {
		const v = createValchecker({ steps: [string, empty] })
		const schema = v.string().empty()
		schema.execute('')
	})
})

// JSON operations
describe('jSON Operations', () => {
	bench('json - JSON validation', () => {
		const v = createValchecker({ steps: [json, string] })
		const schema = v.json(v.string())
		schema.execute('"hello"')
	})

	bench('parseJSON - parse JSON', () => {
		const v = createValchecker({ steps: [string, parseJSON] })
		const schema = v.string().parseJSON()
		schema.execute('{"name":"John"}')
	})

	bench('stringifyJSON - stringify to JSON', () => {
		const v = createValchecker({ steps: [object, string, stringifyJSON] })
		const schema = v.object({ name: v.string() }).stringifyJSON()
		schema.execute({ name: 'John' })
	})
})

// Class instance
describe('instance Operations', () => {
	bench('instance - Date instance', () => {
		const v = createValchecker({ steps: [instance] })
		const schema = v.instance(Date)
		schema.execute(new Date())
	})

	bench('instance - Error instance', () => {
		const v = createValchecker({ steps: [instance] })
		const schema = v.instance(Error)
		schema.execute(new Error('test'))
	})
})

// Generic
describe('generic Operations', () => {
	bench('generic - custom validator', () => {
		const v = createValchecker({ steps: [generic] })
		const schema = v.generic(
			(value): value is string => typeof value === 'string',
			'Expected a string',
		)
		schema.execute('hello')
	})
})
