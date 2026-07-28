import { describe, expect, it } from 'vitest'
import { array, boolean, createValchecker, number, string, toAsync, transform, tuple, union } from '../..'
import { structuralFixture } from '../../test-utils/fixtures'

const v = createValchecker({
	steps: [tuple, structuralFixture, array, boolean, number, string, toAsync, transform, union],
})

describe('tuple step plugin — fixed shape', () => {
	it('accepts a matching fixed tuple and returns a fresh mutable array', () => {
		const schema = v.tuple([v.string(), v.number()])
		const result = schema.execute(['a', 1])
		expect(result)
			.toEqual({ value: ['a', 1] })
		expect(Array.isArray((result as { value: unknown[] }).value))
			.toBe(true)
	})

	it.each([
		['too short', ['a'], 1],
		['too long', ['a', 1, 2], 3],
	] as const)('rejects a %s tuple with the full owned length payload', (_kind, value, length) => {
		expect(v.tuple([v.string(), v.number()])
			.execute([...value]))
			.toEqual({
				issues: [{
					code: 'tuple:unexpected_length',
					category: 'validation',
					message: 'Expected a tuple of length 2.',
					path: [],
					payload: { value, expectedLength: 2, length },
				}],
			})
	})

	it.each([
		['null', null],
		['object', {}],
		['string', 'ab'],
	] as const)('rejects %s as a non-array', (_kind, value) => {
		expect(v.tuple([v.string()])
			.execute(value))
			.toEqual({
				issues: [{
					code: 'tuple:expected_array',
					category: 'validation',
					message: 'Expected an array.',
					path: [],
					payload: { value },
				}],
			})
	})

	it('honors custom messages for every owned length classification', () => {
		expect(v.tuple([v.string()], { message: 'need array' })
			.execute(null))
			.toMatchObject({ issues: [{ code: 'tuple:expected_array', message: 'need array' }] })
		expect(v.tuple([v.string(), v.number()], { message: 'bad length' })
			.execute(['a']))
			.toMatchObject({ issues: [{ code: 'tuple:unexpected_length', message: 'bad length' }] })
		expect(v.tuple([v.string(), '...', v.array(v.number())], { message: 'too few' })
			.execute([]))
			.toMatchObject({ issues: [{ code: 'tuple:expected_length_at_least', message: 'too few' }] })
	})

	it('reports element failures under absolute indices and collects them in order', () => {
		expect(v.tuple([v.string(), v.number()])
			.execute(['a', 'x']))
			.toMatchObject({ issues: [{ code: 'number:expected_number', path: [1], payload: { value: 'x' } }] })
		expect(v.tuple([v.number(), v.number()], { collectAllIssues: true })
			.execute(['x', 'y']))
			.toMatchObject({
				issues: [
					{ code: 'number:expected_number', path: [0] },
					{ code: 'number:expected_number', path: [1] },
				],
			})
	})

	it('accepts the empty tuple', () => {
		expect(v.tuple([])
			.execute([]))
			.toEqual({ value: [] })
		expect(v.tuple([])
			.execute([1]))
			.toMatchObject({ issues: [{ code: 'tuple:unexpected_length' }] })
	})

	it('transforms elements', () => {
		expect(v.tuple([v.string()
			.transform(s => s.length), v.number()])
			.execute(['abc', 5]))
			.toEqual({ value: [3, 5] })
	})
})

describe('tuple step plugin — rest region', () => {
	it('spreads a trailing variadic array rest', () => {
		const schema = v.tuple([v.string(), '...', v.array(v.number())])
		expect(schema.execute(['a']))
			.toEqual({ value: ['a'] })
		expect(schema.execute(['a', 1, 2, 3]))
			.toEqual({ value: ['a', 1, 2, 3] })
		expect(schema.execute(['a', 1, 'x']))
			.toMatchObject({ issues: [{ code: 'number:expected_number', path: [2], context: [{ type: 'tuple', part: 'rest' }] }] })
		expect(schema.execute([]))
			.toEqual({
				issues: [{
					code: 'tuple:expected_length_at_least',
					category: 'validation',
					message: 'Expected a tuple of length at least 1.',
					path: [],
					payload: { value: [], minimumLength: 1, length: 0 },
				}],
			})
	})

	it('spreads a middle rest between a prefix and a suffix', () => {
		const schema = v.tuple([v.string(), '...', v.array(v.boolean()), v.number()])
		expect(schema.execute(['a', true, false, 5]))
			.toEqual({ value: ['a', true, false, 5] })
		expect(schema.execute(['a', 5]))
			.toEqual({ value: ['a', 5] })
		expect(schema.execute(['a', 'bad', 5]))
			.toMatchObject({ issues: [{ code: 'boolean:expected_boolean', path: [1], context: [{ type: 'tuple', part: 'rest' }] }] })
		expect(schema.execute(['a']))
			.toMatchObject({ issues: [{ code: 'tuple:expected_length_at_least', payload: { minimumLength: 2 } }] })
		expect(schema.execute(['a', true, 'no']))
			.toMatchObject({ issues: [{ code: 'number:expected_number', path: [2] }] })
	})

	it('spreads a leading rest before a suffix', () => {
		const schema = v.tuple(['...', v.array(v.boolean()), v.string()])
		expect(schema.execute([true, false, 'x']))
			.toEqual({ value: [true, false, 'x'] })
		expect(schema.execute(['x']))
			.toEqual({ value: ['x'] })
		expect(schema.execute([]))
			.toMatchObject({ issues: [{ code: 'tuple:expected_length_at_least', payload: { minimumLength: 1 } }] })
		expect(schema.execute([true, false, 1]))
			.toMatchObject({ issues: [{ code: 'string:expected_string', path: [2] }] })
	})

	it('spreads a fixed-length tuple rest and remaps inner paths', () => {
		const schema = v.tuple([v.string(), '...', v.tuple([v.number(), v.boolean()])])
		expect(schema.execute(['a', 1, true]))
			.toEqual({ value: ['a', 1, true] })
		expect(schema.execute(['a', 1]))
			.toMatchObject({ issues: [{ code: 'tuple:unexpected_length', path: [], context: [{ type: 'tuple', part: 'rest' }] }] })
		expect(schema.execute(['a', 'x', true]))
			.toMatchObject({ issues: [{ code: 'number:expected_number', path: [1], context: [{ type: 'tuple', part: 'rest' }] }] })
	})

	it('models the optional-element workaround with a union of tuples', () => {
		const schema = v.tuple([v.string(), '...', v.union([v.tuple([]), v.tuple([v.number()])])])
		expect(schema.execute(['a']))
			.toEqual({ value: ['a'] })
		expect(schema.execute(['a', 1]))
			.toEqual({ value: ['a', 1] })
		expect(v.isFailure(schema.execute(['a', 1, 2])))
			.toBe(true)
	})

	it('transforms elements inside the rest region', () => {
		expect(v.tuple([v.string(), '...', v.array(v.number()
			.transform(n => n * 2))])
			.execute(['a', 1, 2]))
			.toEqual({ value: ['a', 2, 4] })
	})

	it('slices the rest region without delegating to a subclass-overridden slice', () => {
		class Weird extends Array {
			override slice() {
				return [] as unknown[]
			}
		}
		const input = new Weird()
		input.push('a', 1, 2)
		expect(v.tuple([v.string(), '...', v.array(v.number())])
			.execute(input as unknown[]))
			.toEqual({ value: ['a', 1, 2] })
	})

	it('short-circuits on an internal rest issue even with collectAllIssues', () => {
		const schema = v.tuple([v.string(), '...', v.array(v.number()
			.internalFailure()), v.boolean()], { collectAllIssues: true })
		expect(schema.execute(['a', 1, 'not a boolean']))
			.toMatchObject({ issues: [{ category: 'internal' }] })
	})

	it('stops at a recoverable rest issue without validating the suffix', () => {
		expect(v.tuple([v.string(), '...', v.array(v.number()), v.boolean()])
			.execute(['a', 'x', 'not a boolean']))
			.toMatchObject({
				issues: [
					{ code: 'number:expected_number', path: [1], context: [{ type: 'tuple', part: 'rest' }] },
				],
			})
	})

	it('collects a rest issue together with a later suffix issue', () => {
		expect(v.tuple([v.string(), '...', v.array(v.number()), v.boolean()], { collectAllIssues: true })
			.execute(['a', 'x', 'not a boolean']))
			.toMatchObject({
				issues: [
					{ code: 'number:expected_number', path: [1], context: [{ type: 'tuple', part: 'rest' }] },
					{ code: 'boolean:expected_boolean', path: [2] },
				],
			})
	})
})

describe('tuple step plugin — asynchronous', () => {
	it('resolves asynchronously when the prefix, rest, or suffix is async', async () => {
		await expect(v.tuple([v.string()
			.toAsync(), v.number()])
			.execute(['a', 1]))
			.resolves.toEqual({ value: ['a', 1] })
		await expect(v.tuple([v.string(), '...', v.array(v.number()
			.toAsync())])
			.execute(['a', 1, 2]))
			.resolves.toEqual({ value: ['a', 1, 2] })
		await expect(v.tuple(['...', v.array(v.boolean()), v.number()
			.toAsync()])
			.execute([true, 5]))
			.resolves.toEqual({ value: [true, 5] })
	})

	it('validates the rest region against the input slice after an asynchronous prefix element', async () => {
		await expect(v.tuple([v.string()
			.toAsync(), '...', v.array(v.number())])
			.execute(['a', 1, 2]))
			.resolves.toEqual({ value: ['a', 1, 2] })
	})

	it('validates a suffix element after an asynchronous rest region', async () => {
		await expect(v.tuple(['...', v.array(v.number()
			.toAsync()), v.boolean()])
			.execute([1, 2, true]))
			.resolves.toEqual({ value: [1, 2, true] })
	})

	it('validates the remaining suffix elements after the first one suspends', async () => {
		await expect(v.tuple(['...', v.array(v.number()), v.string()
			.toAsync(), v.boolean()])
			.execute([1, 'x', true]))
			.resolves.toEqual({ value: [1, 'x', true] })
	})

	it('resumes the suffix at the element that suspended, without repeating earlier ones', async () => {
		await expect(v.tuple(['...', v.array(v.number()), v.string(), v.boolean()
			.toAsync()])
			.execute([1, 'x', true]))
			.resolves.toEqual({ value: [1, 'x', true] })
	})

	it('stays synchronous when a maybe-async suffix element resolves synchronously', () => {
		const result = v.tuple([v.string(), '...', v.array(v.boolean()), v.number()
			.transform(n => n * 2)])
			.execute(['a', true, 5])

		expect(result).not.toBeInstanceOf(Promise)
		expect(result)
			.toEqual({ value: ['a', true, 10] })
	})

	it('traverses the length the input had when validation started, synchronously and asynchronously', async () => {
		const syncInput: unknown[] = ['a', true, 5]
		expect(v.tuple([v.string()
			.transform((value) => {
				syncInput.push(false)
				return value
			}), '...', v.array(v.boolean()), v.number()])
			.execute(syncInput))
			.toEqual({ value: ['a', true, 5] })

		const asyncInput: unknown[] = ['a', true, 5]
		await expect(v.tuple([v.string()
			.transform((value) => {
				asyncInput.push(false)
				return Promise.resolve(value)
			}), '...', v.array(v.boolean()), v.number()])
			.execute(asyncInput))
			.resolves.toEqual({ value: ['a', true, 5] })
	})
})

describe('tuple step plugin — construction validation', () => {
	it.each([
		['two rest markers', [v.string(), '...', v.array(v.number()), '...', v.array(v.boolean())], 'tuple() allows at most one "..." rest marker.'],
		['trailing marker', [v.string(), '...'], 'tuple() "..." must be followed by a rest schema.'],
		['adjacent markers', ['...', '...', v.array(v.number())], 'tuple() "..." must be followed by a rest schema.'],
		['a rest marker followed by a primitive', ['...', 42], 'tuple() "..." must be followed by a rest schema.'],
		['a rest marker followed by a plain object', ['...', {}], 'tuple() "..." must be followed by a rest schema.'],
		['non-schema element', [v.string(), 42], 'tuple() element at index 1 must be a Valchecker schema.'],
		['plain object element', [{}], 'tuple() element at index 0 must be a Valchecker schema.'],
		['null element', [null], 'tuple() element at index 0 must be a Valchecker schema.'],
		['optional-shorthand element array', [[v.number()]], 'tuple() element at index 0 must be a Valchecker schema.'],
	] as const)('throws a TypeError naming the arrangement for %s', (_kind, elements, message) => {
		expect(() => v.tuple(elements as any))
			.toThrow(TypeError)
		expect(() => v.tuple(elements as any))
			.toThrow(message)
	})

	it('does not collide with the object optional-field shorthand: a single-element array is a 1-tuple', () => {
		expect(v.tuple([v.number()])
			.execute([7]))
			.toEqual({ value: [7] })
	})

	it('requires an element array', () => {
		expect(() => v.tuple(42 as any))
			.toThrow(new TypeError('tuple() requires an element array.'))
	})

	it('reports a rest schema that succeeds with a non-array as a fatal internal issue', () => {
		// The type gate rejects this rest schema, so reaching the guard needs `any`:
		// a rest region has nothing to spread when its schema transforms the slice
		// into something that is not an array. The guard throws a TypeError, which
		// the core converts into an internal issue rather than letting it escape.
		const schema = v.tuple([v.string(), '...', (v.array(v.number()) as any)
			.transform((items: number[]) => items.length)] as any)

		expect(schema.execute(['a', 1, 2]))
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					path: [],
					payload: {
						method: 'tuple',
						error: new TypeError('tuple() rest schema must output an array.'),
					},
				}],
			})
	})
})

describe('tuple step plugin — rest-region message scoping', () => {
	it('applies the enclosing message as a scope over a plain rest child issue', () => {
		expect(v.tuple([v.string(), '...', v.array(v.number())], { message: 'bad rest' })
			.execute(['a', 'x']))
			.toMatchObject({ issues: [{ code: 'number:expected_number', path: [1], message: 'bad rest' }] })
	})

	it('preserves a deferred child message while remapping the rest path', () => {
		expect(v.tuple([v.string(), '...', v.array(v.number({ message: issue => `n:${issue.code}` }))])
			.execute(['a', 'x']))
			.toMatchObject({ issues: [{ code: 'number:expected_number', path: [1], message: 'n:number:expected_number' }] })
	})

	it('layers the enclosing scope over a deferred child message', () => {
		expect(v.tuple([v.string(), '...', v.array(v.number({ message: issue => `n:${issue.code}` }))], { message: 'wrapped' })
			.execute(['a', 'x']))
			.toMatchObject({ issues: [{ code: 'number:expected_number', path: [1] }] })
	})
})
