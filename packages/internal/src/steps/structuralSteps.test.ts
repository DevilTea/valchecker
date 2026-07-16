import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { InferOutput } from '../core'
import {
	check,
	createValchecker,
	literal,
	map,
	number,
	object,
	picklist,
	record,
	set,
	string,
	toAsync,
	transform,
	tuple,
	variant,
} from '..'

const v = createValchecker({
	steps: [
		check,
		literal,
		map,
		number,
		object,
		picklist,
		record,
		set,
		string,
		toAsync,
		transform,
		tuple,
		variant,
	],
})

describe('structural schema steps', () => {
	it('validates picklists and infers their literal union', () => {
		const schema = v.picklist(['draft', 'published', null] as const)
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<'draft' | 'published' | null>()
		expect(schema.execute('draft')).toEqual({ value: 'draft' })
		expect(schema.execute(null)).toEqual({ value: null })
		expect(schema.execute('other')).toMatchObject({ issues: [{ code: 'picklist:expected_value' }] })
		expect(v.picklist([1, 2] as const, 'Not allowed').execute(3)).toMatchObject({ issues: [{ message: 'Not allowed' }] })
	})

	it('validates exact and variadic tuples without stripping', async () => {
		const fixed = v.tuple([v.string(), v.number()] as const)
		expectTypeOf<InferOutput<typeof fixed>>().toEqualTypeOf<[string, number]>()
		expect(fixed.execute(['a', 1])).toEqual({ value: ['a', 1] })
		expect(fixed.execute(['a'])).toMatchObject({ issues: [{ code: 'tuple:expected_length' }] })
		expect(fixed.execute(['a', 1, 2])).toMatchObject({ issues: [{ code: 'tuple:expected_length' }] })
		expect(fixed.execute(['a', 'x'])).toMatchObject({ issues: [{ path: [1] }] })
		expect(v.tuple([], 'Tuple required').execute({})).toMatchObject({ issues: [{ code: 'tuple:expected_array', message: 'Tuple required' }] })

		const variadic = v.tuple([v.string()] as const, v.number())
		expectTypeOf<InferOutput<typeof variadic>>().toEqualTypeOf<[string, ...number[]]>()
		expect(variadic.execute(['a', 1, 2])).toEqual({ value: ['a', 1, 2] })
		expect(variadic.execute([])).toMatchObject({ issues: [{ code: 'tuple:expected_length' }] })
		expect(await v.tuple([v.string().toAsync()] as const).execute(['a'])).toEqual({ value: ['a'] })
	})

	it('models exhaustive finite records and broad index signatures', async () => {
		const finite = v.record(['en', 'zh-TW'] as const, v.string())
		expectTypeOf<InferOutput<typeof finite>>().toEqualTypeOf<Record<'en' | 'zh-TW', string>>()
		expect(finite.execute({ en: 'Hello', 'zh-TW': '哈囉' })).toEqual({ value: { en: 'Hello', 'zh-TW': '哈囉' } })
		expect(finite.execute({ en: 'Hello' })).toMatchObject({ issues: [{ code: 'record:missing_key', path: ['zh-TW'] }] })
		expect(finite.execute({ en: 'Hello', 'zh-TW': '哈囉', ja: 'x' })).toMatchObject({ issues: [{ code: 'record:unexpected_key', path: ['ja'] }] })

		const broad = v.record(v.string(), v.number())
		expectTypeOf<InferOutput<typeof broad>>().toEqualTypeOf<Record<string, number>>()
		expect(broad.execute({ a: 1, b: 2 })).toEqual({ value: { a: 1, b: 2 } })
		expect(broad.execute({ a: 'x' })).toMatchObject({ issues: [{ code: 'number:expected_number', path: ['a'] }] })
		expect(v.record(v.number(), v.string()).execute({ 1: 'one' })).toEqual({ value: { 1: 'one' } })
		expect(v.record(v.string(), v.string()).execute([])).toMatchObject({ issues: [{ code: 'record:expected_record' }] })

		const collapsed = v.record(v.string().transform(() => 'same'), v.string())
		expect(collapsed.execute({ a: 'x', b: 'y' })).toMatchObject({ issues: [{ code: 'record:duplicate_key' }] })
		const asyncRecord = v.record(v.string().toAsync(), v.string().toAsync())
		expect(await asyncRecord.execute({ a: 'x' })).toEqual({ value: { a: 'x' } })

		// @ts-expect-error Finite key schemas cannot prove missing keys; use the explicit key tuple overload.
		v.record(v.literal('a'), v.string())
	})

	it('validates and transforms Map keys and values', async () => {
		const schema = v.map(v.string().transform(value => value.toUpperCase()), v.number().toAsync())
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<Map<string, number>>()
		expect(await schema.execute(new Map([['a', 1]]))).toEqual({ value: new Map([['A', 1]]) })
		expect(await schema.execute(new Map([[1, 'x']]))).toMatchObject({
			issues: [{ path: [0, 'key'] }, { path: [0, 'value'] }],
		})
		expect(v.map(v.string(), v.number(), 'Map required').execute({})).toMatchObject({ issues: [{ code: 'map:expected_map', message: 'Map required' }] })
	})

	it('validates and transforms Set items', async () => {
		const schema = v.set(v.string().transform(value => value.toUpperCase()).toAsync())
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<Set<string>>()
		expect(await schema.execute(new Set(['a', 'b']))).toEqual({ value: new Set(['A', 'B']) })
		expect(await schema.execute(new Set(['a', 1]))).toMatchObject({ issues: [{ path: [1] }] })
		expect(v.set(v.string(), 'Set required').execute([])).toMatchObject({ issues: [{ code: 'set:expected_set', message: 'Set required' }] })
	})

	it('selects exactly one variant branch', () => {
		const other = vi.fn(() => true)
		const schema = v.variant('type', {
			circle: v.object({ type: v.literal('circle'), radius: v.number() }),
			square: v.object({ type: v.literal('square'), size: v.number() }).check(other),
		})
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<
			| { type: 'circle', radius: number }
			| { type: 'square', size: number }
		>()
		expect(schema.execute({ type: 'circle', radius: 2 })).toEqual({ value: { type: 'circle', radius: 2 } })
		expect(other).not.toHaveBeenCalled()
		expect(schema.execute({ type: 'triangle', size: 2 })).toMatchObject({ issues: [{ code: 'variant:invalid_discriminator', path: ['type'] }] })
		expect(schema.execute(null)).toMatchObject({ issues: [{ code: 'variant:expected_object' }] })

		// @ts-expect-error Empty variants are not meaningful.
		v.variant('type', {})
	})
})
