import { describe, expect, expectTypeOf, it } from 'vitest'
import type { InferOutput } from '../../core'
import { createValchecker } from '../../core'
import { literal } from '../literal'
import { number } from '../number'
import { string } from '../string'
import { symbol } from '../symbol'
import { toAsync } from '../toAsync'
import { transform } from '../transform'
import { union } from '../union'
import { record } from '.'

const v = createValchecker({ steps: [record, literal, number, string, symbol, toAsync, transform, union] })

describe('record step plugin', () => {
	it('models exhaustive finite TypeScript records', () => {
		const schema = v.record(['en', 'zh-TW'] as const, v.string())
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<Record<'en' | 'zh-TW', string>>()
		expect(schema.execute({ en: 'Hello', 'zh-TW': '哈囉' })).toEqual({ value: { en: 'Hello', 'zh-TW': '哈囉' } })
		expect(schema.execute({ en: 'Hello' })).toMatchObject({ issues: [{ code: 'record:missing_key', path: ['zh-TW'] }] })
		expect(schema.execute({ en: 'Hello', 'zh-TW': '哈囉', ja: 'x' })).toMatchObject({ issues: [{ code: 'record:unexpected_key', path: ['ja'] }] })
	})

	it('models broad string, number, and symbol index signatures', () => {
		const stringRecord = v.record(v.string(), v.number())
		expectTypeOf<InferOutput<typeof stringRecord>>().toEqualTypeOf<Record<string, number>>()
		expect(stringRecord.execute({ a: 1, b: 2 })).toEqual({ value: { a: 1, b: 2 } })
		expect(v.record(v.number(), v.string()).execute({ 1: 'one' })).toEqual({ value: { 1: 'one' } })
		expect(v.record(v.number(), v.string()).execute({ invalid: 'value' })).toMatchObject({ issues: [{ path: ['invalid'] }] })
		const key = Symbol('key')
		expect(v.record(v.symbol(), v.string()).execute({ [key]: 'value' })).toEqual({ value: { [key]: 'value' } })
		expect(v.record([key] as const, v.string()).execute({ [key]: 'value' })).toEqual({ value: { [key]: 'value' } })
	})

	it('validates values and rejects non-record inputs', () => {
		expect(v.record(v.string(), v.number()).execute({ a: 'x' })).toMatchObject({ issues: [{ code: 'number:expected_number', path: ['a'] }] })
		expect(v.record(v.string(), v.number()).execute([])).toMatchObject({ issues: [{ code: 'record:expected_record' }] })
	})

	it('rejects duplicate transformed keys and safely writes __proto__', () => {
		const collapsed = v.record(v.string().transform(() => 'same'), v.string())
		expect(collapsed.execute({ a: 'x', b: 'y' })).toMatchObject({ issues: [{ code: 'record:duplicate_key' }] })
		const input = JSON.parse('{"__proto__":"safe"}')
		const result = v.record(['__proto__'] as const, v.string()).execute(input)
		expect(result).toEqual({ value: input })
		expect(Object.getPrototypeOf((result as { value: object }).value)).toBe(Object.prototype)
	})

	it('preserves sequential maybe-async key and value validation', async () => {
		const schema = v.record(v.string().toAsync(), v.string().toAsync())
		expect(await schema.execute({ a: 'x', b: 'y' })).toEqual({ value: { a: 'x', b: 'y' } })
	})

	it('rejects finite literal key schemas at compile time', () => {
		// @ts-expect-error Finite key schemas cannot prove missing keys; use the explicit key tuple overload.
		v.record(v.literal('a'), v.string())
		const broad = v.union([v.string(), v.symbol()])
		v.record(broad, v.string())
	})
})
