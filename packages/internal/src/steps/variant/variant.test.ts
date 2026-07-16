import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { InferOutput } from '../../core'
import { createValchecker } from '../../core'
import { check } from '../check'
import { literal } from '../literal'
import { number } from '../number'
import { object } from '../object'
import { variant } from '.'

const v = createValchecker({ steps: [variant, check, literal, number, object] })

describe('variant step plugin', () => {
	it('selects one discriminator branch and infers its union', () => {
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
	})

	it('rejects missing, unsupported, and unknown discriminators', () => {
		const schema = v.variant('type', { a: v.object({ type: v.literal('a') }) })
		expect(schema.execute({ type: 'b' })).toMatchObject({ issues: [{ code: 'variant:invalid_discriminator', path: ['type'] }] })
		expect(schema.execute({})).toMatchObject({ issues: [{ code: 'variant:invalid_discriminator', path: ['type'] }] })
		expect(schema.execute({ type: true })).toMatchObject({ issues: [{ code: 'variant:invalid_discriminator', path: ['type'] }] })
		expect(schema.execute(null)).toMatchObject({ issues: [{ code: 'variant:expected_object' }] })
	})

	it('supports number and symbol discriminator values with property-key semantics', () => {
		const numeric = v.variant('type', { 1: v.object({ type: v.literal(1) }) })
		expect(numeric.execute({ type: 1 })).toEqual({ value: { type: 1 } })
		const symbolType = Symbol('symbol-variant')
		const symbolic = v.variant('type', { [symbolType]: v.object({ type: v.literal(symbolType) }) })
		expect(symbolic.execute({ type: symbolType })).toEqual({ value: { type: symbolType } })
	})

	it('requires at least one option at compile time', () => {
		// @ts-expect-error Empty variants are not meaningful.
		v.variant('type', {})
	})
})
