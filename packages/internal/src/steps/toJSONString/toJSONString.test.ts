import type { InferOutput } from '../..'
import { runInNewContext } from 'node:vm'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, toJSONString } from '../..'

const v = createValchecker({ steps: [toJSONString] })

function expectNativeJSON(value: unknown): void {
	const expected = JSON.stringify(value)
	expect(typeof expected)
		.toBe('string')
	expect(v.toJSONString()
		.execute(value))
		.toEqual({ value: expected })
}

describe('toJSONString step plugin', () => {
	it.each([
		[null, 'null'],
		[42, '42'],
		['value', '"value"'],
		[true, 'true'],
		[{ value: 42 }, '{"value":42}'],
		[new Object(42), '42'],
		[new Object('value'), '"value"'],
		[new Object(false), 'false'],
	])('serializes %p like JSON.stringify', (value, output) => {
		expect(v.toJSONString()
			.execute(value))
			.toEqual({ value: output })
	})

	it('preserves native omission and array-null coercion for lossy nested slots', () => {
		const symbol = Symbol('dropped')
		const objectValue = {
			undefinedValue: undefined,
			functionValue: () => undefined,
			symbolValue: symbol,
			kept: 1,
		}
		expectNativeJSON(objectValue)

		const sparse = [undefined, () => undefined, symbol, 4]
		delete sparse[3]
		expectNativeJSON(sparse)
	})

	it.each([
		undefined,
		() => undefined,
		Symbol('value'),
		{ toJSON: () => undefined },
	])('reports an undefined top-level JSON.stringify result for %p', (value) => {
		expect(JSON.stringify(value))
			.toBeUndefined()
		expect(v.toJSONString()
			.execute(value))
			.toMatchObject({
				issues: [{
					code: 'toJSONString:unserializable',
					category: 'validation',
					message: 'Value cannot be serialized to JSON.',
					path: [],
					payload: { reason: 'undefined_result', value, at: [] },
				}],
			})
	})

	it('matches native NaN and infinity coercion', () => {
		expectNativeJSON({ nan: Number.NaN, positive: Infinity, negative: -Infinity })
	})

	it('calls getters and toJSON exactly as the native serializer does', () => {
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
		expect(v.toJSONString()
			.execute(value))
			.toEqual({ value: '{"counted":1,"nested":{"ok":true}}' })
		expect(getterReads)
			.toBe(1)
		expect(toJSONCalls)
			.toBe(1)
	})

	it('uses native cross-realm boxed-primitive behavior', () => {
		const values = runInNewContext(`[
			new Number(42),
			new String('hi'),
			new Boolean(true),
			Object(10n),
		]`) as unknown[]
		for (const value of values) {
			let expected: string | undefined
			let nativeError: unknown
			try {
				expected = JSON.stringify(value)
			}
			catch (error) {
				nativeError = error
			}

			const result = v.toJSONString()
				.execute(value)
			if (nativeError === undefined) {
				expect(result)
					.toEqual({ value: expected })
			}
			else {
				expect(result)
					.toMatchObject({
						issues: [{
							code: 'toJSONString:serialization_failed',
							category: 'operation',
							payload: { value, at: [], error: expect.anything() },
						}],
					})
			}
		}
	})

	it('does not invoke Proxy traps that native JSON.stringify does not use', () => {
		const error = new Error('getPrototypeOf')
		const value = new Proxy({}, {
			getPrototypeOf() { throw error },
		})
		expectNativeJSON(value)
	})

	it('serializes prototype-spoofed primitive objects like native JSON.stringify', () => {
		for (const prototype of [Number.prototype, String.prototype, Boolean.prototype, BigInt.prototype])
			expectNativeJSON(Object.create(prototype))
	})

	const cyclicValue: Record<string, unknown> = {}
	cyclicValue.self = cyclicValue

	it.each([
		['bigint', 1n],
		['circular reference', cyclicValue],
	])('reports native serialization throws for %s', (_label, value) => {
		expect(() => JSON.stringify(value))
			.toThrow()
		const result = v.toJSONString()
			.execute(value)
		expect(result)
			.toMatchObject({
				issues: [{
					code: 'toJSONString:serialization_failed',
					category: 'operation',
					message: 'JSON serialization failed.',
					path: [],
					payload: { value, at: [], error: expect.anything() },
				}],
			})
	})

	it('reports getter, Proxy, and toJSON exceptions from native serialization', () => {
		const getterError = new Error('getter')
		const getterValue = Object.defineProperty({}, 'value', {
			enumerable: true,
			get() { throw getterError },
		})
		const getterResult = v.toJSONString()
			.execute(getterValue)
		expect(getterResult)
			.toMatchObject({
				issues: [{
					code: 'toJSONString:serialization_failed',
					payload: { at: [], error: getterError },
				}],
			})
		expect((getterResult as any).issues[0].payload.value)
			.toBe(getterValue)

		const proxyError = new Error('ownKeys')
		const proxy = new Proxy({}, {
			ownKeys() { throw proxyError },
		})
		const proxyResult = v.toJSONString()
			.execute(proxy)
		expect(proxyResult)
			.toMatchObject({
				issues: [{
					code: 'toJSONString:serialization_failed',
					payload: { at: [], error: proxyError },
				}],
			})
		expect((proxyResult as any).issues[0].payload.value)
			.toBe(proxy)

		const toJSONError = new Error('toJSON')
		const toJSONValue = {
			toJSON() { throw toJSONError },
		}
		const toJSONResult = v.toJSONString()
			.execute(toJSONValue)
		expect(toJSONResult)
			.toMatchObject({
				issues: [{
					code: 'toJSONString:serialization_failed',
					payload: { at: [], error: toJSONError },
				}],
			})
		expect((toJSONResult as any).issues[0].payload.value)
			.toBe(toJSONValue)
	})

	it('supports custom messages for both owned failures', () => {
		expect(v.toJSONString({ message: 'Custom stringify' })
			.execute(undefined))
			.toMatchObject({ issues: [{ message: 'Custom stringify' }] })
		expect(v.toJSONString({ message: 'Custom stringify' })
			.execute(1n))
			.toMatchObject({ issues: [{ message: 'Custom stringify' }] })
	})

	it('infers a string output', () => {
		const _schema = v.toJSONString()
		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<string>()
	})
})
