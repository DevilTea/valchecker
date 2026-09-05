import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, toStrictJSONString } from '../..'

const v = createValchecker({ steps: [toStrictJSONString] })

describe('toStrictJSONString step plugin', () => {
	it.each([
		[null, 'null'],
		[42, '42'],
		['value', '"value"'],
		[true, 'true'],
		[{ value: 42 }, '{"value":42}'],
		[new Object(42), '42'],
		[new Object('value'), '"value"'],
		[new Object(false), 'false'],
	])('serializes %p', (value, output) => {
		expect(v.toStrictJSONString()
			.execute(value))
			.toEqual({ value: output })
	})

	it('serializes NaN and the infinities as null, like JSON.stringify', () => {
		expect(v.toStrictJSONString()
			.execute({ nan: Number.NaN, positive: Infinity, negative: -Infinity }))
			.toEqual({ value: '{"nan":null,"positive":null,"negative":null}' })
	})

	it('ignores symbol-keyed properties during preflight', () => {
		// An unsupported value behind a symbol key would fail if symbol keys were
		// walked, so this distinguishes dropping them from serializing them.
		const value = { [Symbol('dropped')]: 1n, own: 1 }
		expect(v.toStrictJSONString()
			.execute(value))
			.toEqual({ value: '{"own":1}' })
	})

	it('reads a getter and calls a toJSON method exactly once', () => {
		let getterReads = 0
		let toJSONCalls = 0
		const value = {
			get counted() {
				getterReads++
				return 1
			},
			nested: {
				toJSON() {
					toJSONCalls++
					return { ok: true }
				},
			},
		}
		expect(v.toStrictJSONString()
			.execute(value))
			.toEqual({ value: '{"counted":1,"nested":{"ok":true}}' })
		expect(getterReads)
			.toBe(1)
		expect(toJSONCalls)
			.toBe(1)
	})

	it.each<[label: string, value: unknown, expected: Record<string, unknown>]>([
		['a function', () => undefined, { reason: 'unsupported_type', at: [], valueType: 'function' }],
		['a function under a property', { value: () => undefined }, { reason: 'unsupported_type', at: ['value'], valueType: 'function' }],
		['a bigint', 1n, { reason: 'unsupported_type', at: [], valueType: 'bigint' }],
		['a boxed bigint', new Object(1n), { reason: 'unsupported_type', at: [], valueType: 'bigint' }],
		['a symbol', Symbol('value'), { reason: 'unsupported_type', at: [], valueType: 'symbol' }],
		['undefined', undefined, { reason: 'undefined_result', at: [] }],
	])('rejects %s with its own reason', (_label, value, expected) => {
		expect(v.toStrictJSONString()
			.execute(value))
			.toMatchObject({
				issues: [{
					code: 'toStrictJSONString:unserializable',
					category: 'validation',
					message: 'Value cannot be serialized to JSON.',
					path: [],
					payload: { value, ...expected },
				}],
			})
	})

	it('rejects a toJSON method that returns undefined', () => {
		const value = Object.defineProperty({}, 'toJSON', {
			value: () => undefined,
		})
		expect(v.toStrictJSONString()
			.execute(value))
			.toMatchObject({
				issues: [{
					code: 'toStrictJSONString:unserializable',
					category: 'validation',
					message: 'Value cannot be serialized to JSON.',
					path: [],
					payload: { reason: 'undefined_result', value, at: [] },
				}],
			})
	})

	it('reports a circular structure rather than recursing', () => {
		const value: Record<string, unknown> = {}
		value.self = value
		expect(v.toStrictJSONString()
			.execute(value))
			.toMatchObject({
				issues: [{
					code: 'toStrictJSONString:unserializable',
					category: 'validation',
					message: 'Value cannot be serialized to JSON.',
					path: [],
					payload: { reason: 'circular_reference', value, at: ['self'] },
				}],
			})
	})

	it('ignores inherited enumerable properties during preflight', () => {
		const inherited = { inherited: 1n }
		const value = Object.assign(Object.create(inherited), { own: 1 })
		expect(v.toStrictJSONString()
			.execute(value))
			.toEqual({ value: '{"own":1}' })
	})

	it('reports getter, proxy, and toJSON failures with their paths', () => {
		const getterError = new Error('getter')
		const getterValue = Object.defineProperty({}, 'value', {
			enumerable: true,
			get() { throw getterError },
		})
		const getterResult = v.toStrictJSONString()
			.execute(getterValue)
		expect(getterResult)
			.toMatchObject({
				issues: [{
					code: 'toStrictJSONString:serialization_failed',
					category: 'operation',
					payload: { at: ['value'], error: getterError },
				}],
			})
		expect((getterResult as any).issues[0].payload.value)
			.toBe(getterValue)

		const proxyError = new Error('ownKeys')
		const proxy = new Proxy({}, { ownKeys() {
			throw proxyError
		} })
		const proxyResult = v.toStrictJSONString()
			.execute(proxy)
		expect(proxyResult)
			.toMatchObject({
				issues: [{
					code: 'toStrictJSONString:serialization_failed',
					payload: { at: [], error: proxyError },
				}],
			})
		expect((proxyResult as any).issues[0].payload.value)
			.toBe(proxy)

		const toJSONError = new Error('toJSON')
		const toJSONValue = { toJSON() {
			throw toJSONError
		} }
		const toJSONResult = v.toStrictJSONString()
			.execute(toJSONValue)
		expect(toJSONResult)
			.toMatchObject({
				issues: [{
					code: 'toStrictJSONString:serialization_failed',
					payload: { at: [], error: toJSONError },
				}],
			})
		expect((toJSONResult as any).issues[0].payload.value)
			.toBe(toJSONValue)
	})

	it('owns boxed-wrapper reflective failures at the current value path', () => {
		const prototypeError = new Error('getPrototypeOf')
		const proxy = new Proxy({}, {
			getPrototypeOf() { throw prototypeError },
		})
		const proxyResult = v.toStrictJSONString()
			.execute({ nested: proxy })
		expect(proxyResult)
			.toMatchObject({
				issues: [{
					code: 'toStrictJSONString:serialization_failed',
					category: 'operation',
					payload: { at: ['nested'], error: prototypeError },
				}],
			})

		const spoofed = Object.create(Number.prototype)
		const spoofedResult = v.toStrictJSONString()
			.execute({ nested: spoofed })
		expect(spoofedResult)
			.toMatchObject({
				issues: [{
					code: 'toStrictJSONString:serialization_failed',
					category: 'operation',
					payload: { at: ['nested'], error: expect.any(TypeError) },
				}],
			})
	})

	it('owns array descriptor-trap failures at the element path', () => {
		const descriptorError = new Error('getOwnPropertyDescriptor')
		const value = new Proxy([1], {
			getOwnPropertyDescriptor() { throw descriptorError },
		})
		const result = v.toStrictJSONString()
			.execute(value)
		expect(result)
			.toMatchObject({
				issues: [{
					code: 'toStrictJSONString:serialization_failed',
					category: 'operation',
					payload: { at: [0], error: descriptorError },
				}],
			})
	})

	it('serializes dense array values', () => {
		expect(v.toStrictJSONString()
			.execute([1, { value: true }]))
			.toEqual({
				value: '[1,{"value":true}]',
			})
	})

	it('rejects array holes at their exact path instead of coercing to null', () => {
		const sparse = [1, 2, 3]
		delete sparse[1]
		expect(v.toStrictJSONString()
			.execute(sparse))
			.toMatchObject({
				issues: [{
					code: 'toStrictJSONString:unserializable',
					category: 'validation',
					payload: {
						reason: 'undefined_result',
						value: sparse,
						at: [1],
					},
				}],
			})
	})

	it('reports array element and toJSON property access failures', () => {
		const elementError = new Error('element')
		const arrayValue = Object.defineProperty([1], 0, {
			enumerable: true,
			get() { throw elementError },
		})
		const arrayResult = v.toStrictJSONString()
			.execute(arrayValue)
		expect(arrayResult)
			.toMatchObject({
				issues: [{
					code: 'toStrictJSONString:serialization_failed',
					payload: { at: [0], error: elementError },
				}],
			})
		expect((arrayResult as any).issues[0].payload.value)
			.toBe(arrayValue)

		const toJSONGetterError = new Error('toJSON getter')
		const toJSONGetterValue = Object.defineProperty({}, 'toJSON', {
			get() { throw toJSONGetterError },
		})
		const toJSONGetterResult = v.toStrictJSONString()
			.execute(toJSONGetterValue)
		expect(toJSONGetterResult)
			.toMatchObject({
				issues: [{
					code: 'toStrictJSONString:serialization_failed',
					payload: { at: [], error: toJSONGetterError },
				}],
			})
		expect((toJSONGetterResult as any).issues[0].payload.value)
			.toBe(toJSONGetterValue)
	})

	it('reports nested unsupported values at their exact path', () => {
		const value = { nested: { value: 1n } }
		expect(v.toStrictJSONString()
			.execute(value))
			.toMatchObject({
				issues: [{
					code: 'toStrictJSONString:unserializable',
					payload: {
						reason: 'unsupported_type',
						value,
						at: ['nested', 'value'],
						valueType: 'bigint',
					},
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.toStrictJSONString({ message: 'Custom stringify' })
			.execute(undefined))
			.toMatchObject({
				issues: [{ message: 'Custom stringify' }],
			})
	})

	it('captures the custom message when the schema is constructed', () => {
		const options = { message: 'Original stringify' }
		const schema = v.toStrictJSONString(options)
		options.message = 'Changed stringify'

		expect(schema.execute(undefined))
			.toMatchObject({
				issues: [{ message: 'Original stringify' }],
			})
	})

	it('infers a string output', () => {
		const _schema = v.toStrictJSONString()
		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<string>()
	})
})
