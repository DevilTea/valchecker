import { describe, expect, it } from 'vitest'
import { createValchecker, isOneOf, isStartingWith, literal, looseNumber, number, record, string, symbol, toAsync, transform, union } from '../..'
import { structuralFixture } from '../../test-utils/fixtures'
import { literalMembersMarker } from '../literal/literal-members'

const v = createValchecker({
	steps: [record, structuralFixture, isOneOf, isStartingWith, literal, looseNumber, number, string, symbol, toAsync, transform, union],
})

describe('record step plugin — non-finite (open) key domain', () => {
	it.each([
		['null', null],
		['undefined', undefined],
		['number', 0],
		['string', 'x'],
		['boolean', true],
		['array', []],
		['non-empty array', [1]],
	] as const)('rejects %s as a non-object', (_kind, value) => {
		expect(v.record({ key: v.string(), value: v.number() })
			.execute(value))
			.toEqual({
				issues: [{
					code: 'record:expected_object',
					category: 'validation',
					message: 'Expected an object.',
					path: [],
					payload: { value },
				}],
			})
	})

	it('accepts a string custom message and a function custom message for the classification issue', () => {
		expect(v.record({ key: v.string(), value: v.number(), message: 'Record required' })
			.execute(1))
			.toMatchObject({ issues: [{ code: 'record:expected_object', message: 'Record required' }] })
		expect(v.record({ key: v.string(), value: v.number(), message: issue => `record:${issue.code}` })
			.execute(1))
			.toMatchObject({ issues: [{ code: 'record:expected_object', message: 'record:record:expected_object' }] })
	})

	it('returns transformed entries in key order without mutating the input', () => {
		const input = { a: 1, b: 2 }
		const schema = v.record({ key: v.string(), value: v.number()
			.transform(value => value * 10) })

		const result = schema.execute(input)
		expect(result)
			.toEqual({ value: { a: 10, b: 20 } })
		expect(Object.keys((result as { value: object }).value))
			.toEqual(['a', 'b'])
		expect(input)
			.toEqual({ a: 1, b: 2 })
	})

	it('reports a value failure under the source key path', () => {
		expect(v.record({ key: v.string(), value: v.number() })
			.execute({ a: 1, b: 'x' }))
			.toMatchObject({ issues: [{ code: 'number:expected_number', path: ['b'], payload: { value: 'x' } }] })
	})

	it('runs the key schema and tags key failures with a record-key context', () => {
		expect(v.record({ key: v.string()
			.isStartingWith('k-'), value: v.number() })
			.execute({ 'k-a': 1, 'x': 2 }))
			.toMatchObject({
				issues: [{
					code: 'isStartingWith:expected_starting_with',
					path: ['x'],
					context: [{ type: 'record', part: 'key' }],
				}],
			})
	})

	it('validates a symbol key domain and rejects string keys', () => {
		const schema = v.record({ key: v.symbol(), value: v.number() })
		const key = Symbol('id')
		expect(schema.execute({ [key]: 1 }))
			.toEqual({ value: { [key]: 1 } })
		expect(schema.execute({ a: 1 }))
			.toMatchObject({ issues: [{ code: 'symbol:expected_symbol', path: ['a'], context: [{ type: 'record', part: 'key' }] }] })
	})

	it('canonicalizes numeric-output keys from a looseNumber key schema', () => {
		expect(v.record({ key: v.looseNumber(), value: v.number() })
			.execute({ 1: 10 }))
			.toEqual({ value: { 1: 10 } })
	})

	it('rejects transformed key collisions with the full owned payload and a custom message', () => {
		const input = { a: 1, A: 2 }
		expect(v.record({ key: v.string()
			.transform(k => k.toUpperCase()), value: v.number() })
			.execute(input))
			.toEqual({
				issues: [{
					code: 'record:duplicate_transformed_key',
					category: 'validation',
					message: 'Expected transformed record keys to be unique.',
					path: ['A'],
					payload: { value: input, firstSourceKey: 'a', sourceKey: 'A', transformedKey: 'A' },
				}],
			})
		expect(v.record({ key: v.string()
			.transform(k => k.toUpperCase()), value: v.number(), message: 'dup' })
			.execute({ a: 1, A: 2 }))
			.toMatchObject({ issues: [{ code: 'record:duplicate_transformed_key', message: 'dup' }] })
	})

	it('writes a __proto__ own key safely without polluting the prototype', () => {
		const input = JSON.parse('{"__proto__": 1, "a": 2}') as Record<string, number>
		const result = v.record({ key: v.string(), value: v.number() })
			.execute(input) as { value: Record<string, unknown> }
		expect(Object.getPrototypeOf(result.value))
			.toBe(Object.prototype)
		expect(Object.hasOwn(result.value, '__proto__'))
			.toBe(true)
		expect((({} as any).polluted))
			.toBeUndefined()
	})

	it('ignores inherited and non-enumerable own keys', () => {
		const proto = { inherited: 1 }
		const input = Object.create(proto) as Record<string, number>
		input.own = 2
		Object.defineProperty(input, 'hidden', { value: 3, enumerable: false })
		expect(v.record({ key: v.string(), value: v.number() })
			.execute(input))
			.toEqual({ value: { own: 2 } })
	})

	it('collects every recoverable value failure in key order under collectAllIssues', () => {
		expect(v.record({ key: v.string(), value: v.number(), collectAllIssues: true })
			.execute({ a: 'x', b: 'y' }))
			.toMatchObject({
				issues: [
					{ code: 'number:expected_number', path: ['a'] },
					{ code: 'number:expected_number', path: ['b'] },
				],
			})
	})

	it('stops on the first failure without collectAllIssues', () => {
		expect(v.record({ key: v.string(), value: v.number() })
			.execute({ a: 'x', b: 'y' }))
			.toMatchObject({ issues: [{ path: ['a'] }] })
	})

	it('short-circuits on an internal child issue even with collectAllIssues', () => {
		const schema = v.record({
			key: v.string(),
			value: v.number()
				.internalFailure(),
			collectAllIssues: true,
		})
		expect(schema.execute({ a: 1, b: 2 }))
			.toMatchObject({ issues: [{ category: 'internal' }] })
	})

	it('becomes asynchronous when a child schema is async and preserves outcomes', async () => {
		const schema = v.record({ key: v.string(), value: v.number()
			.toAsync() })
		await expect(schema.execute({ a: 1, b: 2 })).resolves.toEqual({ value: { a: 1, b: 2 } })
		await expect(schema.execute({ a: 'x' })).resolves
			.toMatchObject({ issues: [{ code: 'number:expected_number', path: ['a'] }] })
	})

	it('throws at construction when advertised members are not valid property keys', () => {
		const fakeKey = { '~execute': () => ({ value: true }), '~core': { operationMode: 'sync', metadata: { [literalMembersMarker]: [true] } } }
		// Bypass the compile-time key gate to exercise the runtime canonicalization guard.
		expect(() => (v.record as any)({ key: fakeKey, value: v.number() }))
			.toThrow(TypeError)
	})
})

describe('record step plugin — finite (closed, exhaustive) key domain', () => {
	it('requires every member key and reports the full missing-key payload', () => {
		const schema = v.record({ key: v.union(['a', 'b']), value: v.number() })
		expect(schema.execute({ a: 1, b: 2 }))
			.toEqual({ value: { a: 1, b: 2 } })
		expect(schema.execute({ a: 1 }))
			.toEqual({
				issues: [{
					code: 'record:missing_key',
					category: 'validation',
					message: 'Missing required record key.',
					path: ['b'],
					payload: { key: 'b' },
				}],
			})
	})

	it('collects all missing keys under collectAllIssues but stops at the first otherwise', () => {
		const schema = v.record({ key: v.union(['a', 'b']), value: v.number(), collectAllIssues: true })
		expect(schema.execute({}))
			.toMatchObject({
				issues: [{ code: 'record:missing_key', payload: { key: 'a' } }, { code: 'record:missing_key', payload: { key: 'b' } }],
			})
		expect(v.record({ key: v.union(['a', 'b']), value: v.number() })
			.execute({}))
			.toMatchObject({ issues: [{ payload: { key: 'a' } }] })
	})

	it('rejects keys outside the finite domain with the full owned payload', () => {
		const sym = Symbol('extra')
		expect(v.record({ key: v.union(['a', 'b']), value: v.number() })
			.execute({ a: 1, b: 2, c: 3, [sym]: 0 }))
			.toEqual({
				issues: [{
					code: 'record:unexpected_keys',
					category: 'validation',
					message: 'Unexpected record keys found.',
					path: [],
					payload: { keys: ['c', sym], expectedKeys: ['a', 'b'] },
				}],
			})
	})

	it('validates member values under their key path and never executes the key schema', () => {
		expect(v.record({ key: v.union(['a', 'b']), value: v.number() })
			.execute({ a: 1, b: 'x' }))
			.toMatchObject({ issues: [{ code: 'number:expected_number', path: ['b'], payload: { value: 'x' } }] })
	})

	it('supports literal and isOneOf finite key schemas', () => {
		expect(v.record({ key: v.literal('only'), value: v.number() })
			.execute({ only: 1 }))
			.toEqual({ value: { only: 1 } })
		expect(v.record({ key: v.string()
			.isOneOf(['x', 'y']), value: v.number() })
			.execute({ x: 1, y: 2 }))
			.toEqual({ value: { x: 1, y: 2 } })
	})

	it('canonicalizes numeric members to string keys', () => {
		expect(v.record({ key: v.union([1, 2]), value: v.string() })
			.execute({ 1: 'a', 2: 'b' }))
			.toEqual({ value: { 1: 'a', 2: 'b' } })
	})

	it('supports a symbol literal member as a required key', () => {
		const sym = Symbol('key')
		const schema = v.record({ key: v.literal(sym), value: v.number() })
		expect(schema.execute({ [sym]: 5 }))
			.toEqual({ value: { [sym]: 5 } })
		expect(schema.execute({}))
			.toMatchObject({ issues: [{ code: 'record:missing_key', payload: { key: sym } }] })
	})

	it('dedupes members that collapse to the same property key', () => {
		const schema = v.record({ key: v.union([1, '1']), value: v.number() })
		expect(schema.execute({ 1: 5 }))
			.toEqual({ value: { 1: 5 } })
		// A single canonical key means no missing-key issue for a duplicate member.
		expect(v.isSuccess(schema.execute({ 1: 5 })))
			.toBe(true)
	})

	it('collects unexpected keys together with value failures under collectAllIssues', () => {
		expect(v.record({ key: v.union(['a', 'b']), value: v.number(), collectAllIssues: true })
			.execute({ a: 'x', b: 2, c: 3 }))
			.toMatchObject({
				issues: [
					{ code: 'record:unexpected_keys', payload: { keys: ['c'] } },
					{ code: 'number:expected_number', path: ['a'] },
				],
			})
	})
})

describe('record step plugin — asynchronous execution and message scoping', () => {
	it('forwards the parent message handler to child key and value issues', () => {
		expect(v.record({
			key: v.string()
				.isStartingWith('k-'),
			value: v.number(),
			message: issue => `record:${issue.code}`,
			collectAllIssues: true,
		})
			.execute({ x: 'bad' }))
			.toMatchObject({
				issues: [
					{ code: 'isStartingWith:expected_starting_with', message: 'record:isStartingWith:expected_starting_with' },
					{ code: 'number:expected_number', message: 'record:number:expected_number' },
				],
			})
	})

	it('continues past a duplicate transformed key under collectAllIssues', () => {
		expect(v.record({ key: v.string()
			.transform(k => k.toUpperCase()), value: v.number(), collectAllIssues: true })
			.execute({ a: 1, A: 2, b: 'x' }))
			.toMatchObject({
				issues: [
					{ code: 'record:duplicate_transformed_key' },
					{ code: 'number:expected_number', path: ['b'] },
				],
			})
	})

	describe('finite mode', () => {
		const schema = v.record({ key: v.union(['a', 'b']), value: v.number()
			.toAsync() })

		it('resolves member values asynchronously', async () => {
			await expect(schema.execute({ a: 1, b: 2 })).resolves.toEqual({ value: { a: 1, b: 2 } })
		})

		it('reports a missing member key across the async boundary', async () => {
			await expect(schema.execute({ a: 1 })).resolves
				.toMatchObject({ issues: [{ code: 'record:missing_key', payload: { key: 'b' } }] })
		})

		it('reports an async value failure under the member key path', async () => {
			await expect(schema.execute({ a: 1, b: 'x' })).resolves
				.toMatchObject({ issues: [{ code: 'number:expected_number', path: ['b'] }] })
		})

		it('collects every async member failure under collectAllIssues', async () => {
			await expect(v.record({ key: v.union(['a', 'b']), value: v.number()
				.toAsync(), collectAllIssues: true })
				.execute({ a: 'x', b: 'y' })).resolves
				.toMatchObject({ issues: [{ path: ['a'] }, { path: ['b'] }] })
		})
	})

	describe('non-finite mode', () => {
		it('validates an async key schema and tags failures with the record-key context', async () => {
			const schema = v.record({ key: v.string()
				.toAsync(), value: v.number() })
			const sym = Symbol('s')
			await expect(schema.execute({ a: 1 })).resolves.toEqual({ value: { a: 1 } })
			await expect(schema.execute({ [sym]: 1 })).resolves
				.toMatchObject({ issues: [{ code: 'string:expected_string', path: [sym], context: [{ type: 'record', part: 'key' }] }] })
		})

		it('reports an async value failure under the source key', async () => {
			await expect(v.record({ key: v.string(), value: v.number()
				.toAsync() })
				.execute({ a: 'x' })).resolves
				.toMatchObject({ issues: [{ code: 'number:expected_number', path: ['a'] }] })
		})

		it('detects a duplicate transformed key across the async boundary', async () => {
			await expect(v.record({ key: v.string()
				.transform(k => k.toUpperCase()), value: v.number()
				.toAsync() })
				.execute({ a: 1, A: 2 })).resolves
				.toMatchObject({ issues: [{ code: 'record:duplicate_transformed_key', payload: { firstSourceKey: 'a', sourceKey: 'A' } }] })
		})

		it('collects every async value failure under collectAllIssues', async () => {
			await expect(v.record({ key: v.string(), value: v.number()
				.toAsync(), collectAllIssues: true })
				.execute({ a: 'x', b: 'y' })).resolves
				.toMatchObject({ issues: [{ path: ['a'] }, { path: ['b'] }] })
		})

		it('short-circuits on an async internal child issue even with collectAllIssues', async () => {
			await expect(v.record({ key: v.string(), value: v.number()
				.asyncInternalFailure(), collectAllIssues: true })
				.execute({ a: 1, b: 2 })).resolves
				.toMatchObject({ issues: [{ category: 'internal' }] })
		})
	})
})
