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
		expect(v.toJSONString().execute(value)).toEqual({
			issues: [{
				code: 'toJSONString:unserializable',
				message: 'Value cannot be serialized to JSON.',
				path: [],
				payload: { value },
			}],
		})
	})

	it('reports circular structures', () => {
		const value: Record<string, unknown> = {}
		value.self = value
		expect(v.toJSONString().execute(value)).toEqual({
			issues: [{
				code: 'toJSONString:unserializable',
				message: 'Value cannot be serialized to JSON.',
				path: [],
				payload: { value },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.toJSONString('Custom stringify').execute(undefined)).toMatchObject({
			issues: [{ message: 'Custom stringify' }],
		})
	})
})