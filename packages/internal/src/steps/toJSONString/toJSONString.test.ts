import { describe, expect, it } from 'vitest'
import { createValchecker, toJSONString } from '../..'

const v = createValchecker({ steps: [toJSONString] })

describe('toJSONString step plugin', () => {
	it.each([
		[null, 'null'],
		[42, '42'],
		['value', '"value"'],
		[true, 'true'],
		[{ value: 42 }, '{"value":42}'],
	])('serializes %p', (value, output) => {
		expect(v.toJSONString().execute(value)).toEqual({ value: output })
	})

	it.each([
		[() => undefined],
		[{ value: () => undefined }],
		[1n],
	])('rejects unserializable value %p', (value) => {
		expect(v.toJSONString().execute(value)).toMatchObject({
			issues: [{
				code: 'toJSONString:unserializable',
				category: 'validation',
				message: 'Value cannot be serialized to JSON.',
				path: [],
				payload: { value },
			}],
		})
	})

	it('rejects a JSON.stringify result of undefined', () => {
		const value = Object.defineProperty({}, 'toJSON', {
			value: () => undefined,
		})
		expect(v.toJSONString().execute(value)).toMatchObject({
			issues: [{
				code: 'toJSONString:unserializable',
				category: 'validation',
				message: 'Value cannot be serialized to JSON.',
				path: [],
				payload: { value },
			}],
		})
	})

	it('reports circular structures', () => {
		const value: Record<string, unknown> = {}
		value.self = value
		expect(v.toJSONString().execute(value)).toMatchObject({
			issues: [{
				code: 'toJSONString:unserializable',
				category: 'validation',
				message: 'Value cannot be serialized to JSON.',
				path: [],
				payload: { value },
			}],
		})
	})

	it('ignores inherited enumerable properties during preflight', () => {
		const inherited = { inherited: 1n }
		const value = Object.assign(Object.create(inherited), { own: 1 })
		expect(v.toJSONString().execute(value)).toEqual({ value: '{"own":1}' })
	})

	it('reports getter, proxy, and toJSON failures with their paths', () => {
		const getterError = new Error('getter')
		const getterValue = Object.defineProperty({}, 'value', {
			enumerable: true,
			get() { throw getterError },
		})
		const getterResult = v.toJSONString().execute(getterValue)
		expect(getterResult).toMatchObject({
			issues: [{
				code: 'toJSONString:serialization_failed',
				category: 'operation',
				payload: { at: ['value'], error: getterError },
			}],
		})
		expect((getterResult as any).issues[0].payload.value).toBe(getterValue)

		const proxyError = new Error('ownKeys')
		const proxy = new Proxy({}, { ownKeys() { throw proxyError } })
		const proxyResult = v.toJSONString().execute(proxy)
		expect(proxyResult).toMatchObject({
			issues: [{
				code: 'toJSONString:serialization_failed',
				payload: { at: [], error: proxyError },
			}],
		})
		expect((proxyResult as any).issues[0].payload.value).toBe(proxy)

		const toJSONError = new Error('toJSON')
		const toJSONValue = { toJSON() { throw toJSONError } }
		const toJSONResult = v.toJSONString().execute(toJSONValue)
		expect(toJSONResult).toMatchObject({
			issues: [{
				code: 'toJSONString:serialization_failed',
				payload: { at: [], error: toJSONError },
			}],
		})
		expect((toJSONResult as any).issues[0].payload.value).toBe(toJSONValue)
	})

	it('reports nested unsupported values at their exact path', () => {
		const value = { nested: { value: 1n } }
		expect(v.toJSONString().execute(value)).toMatchObject({
			issues: [{
				code: 'toJSONString:unserializable',
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
		expect(v.toJSONString('Custom stringify').execute(undefined)).toMatchObject({
			issues: [{ message: 'Custom stringify' }],
		})
	})
})