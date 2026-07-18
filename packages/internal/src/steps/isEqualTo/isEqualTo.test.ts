import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { bigint, boolean, createValchecker, isEqualTo, null_, number, object, string, symbol, undefined_, union, unknown } from '../..'

const v = createValchecker({
	steps: [bigint, boolean, isEqualTo, null_, number, object, string, symbol, undefined_, union, unknown],
})

describe('isEqualTo step plugin', () => {
	it('uses Object.is semantics', () => {
		expect(v.number().isEqualTo(Number.NaN).execute(Number.NaN)).toEqual({ value: Number.NaN })
		expect(v.number().isEqualTo(-0).execute(0)).toMatchObject({ issues: [{ code: 'isEqualTo:expected_equal_to' }] })
	})

	it('is available after every primitive initial schema', () => {
		const token = Symbol('token')
		expect(v.string().isEqualTo('value').execute('value')).toEqual({ value: 'value' })
		expect(v.number().isEqualTo(1).execute(1)).toEqual({ value: 1 })
		expect(v.bigint().isEqualTo(1n).execute(1n)).toEqual({ value: 1n })
		expect(v.boolean().isEqualTo(true).execute(true)).toEqual({ value: true })
		expect(v.symbol().isEqualTo(token).execute(token)).toEqual({ value: token })
		expect(v.null().isEqualTo(null).execute(null)).toEqual({ value: null })
		expect(v.undefined().isEqualTo(undefined).execute(undefined)).toEqual({ value: undefined })
	})

	it('narrows primitive and mixed primitive-object unions', () => {
		const schema = v.union([v.string(), v.number()]).isEqualTo('ready')
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<'ready'>()
		expect(schema.execute('ready')).toEqual({ value: 'ready' })

		const mixed = v.union([v.string(), v.object({ value: v.number() })]).isEqualTo('ready')
		expectTypeOf<InferOutput<typeof mixed>>().toEqualTypeOf<'ready'>()
		expect(mixed.execute({ value: 1 })).toMatchObject({ issues: [{ code: 'isEqualTo:expected_equal_to' }] })
	})

	it('supports unknown output but excludes initial and object-only states', () => {
		const schema = v.unknown().isEqualTo(true, { message: 'Expected true' })
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<true>()
		expect(schema.execute(false)).toMatchObject({ issues: [{ message: 'Expected true' }] })
		expectTypeOf(v.isEqualTo).toBeNever()
		expectTypeOf(v.object({}).isEqualTo).toBeNever()
		// @ts-expect-error Object expectations are intentionally unavailable.
		v.unknown().isEqualTo({})
	})
})
