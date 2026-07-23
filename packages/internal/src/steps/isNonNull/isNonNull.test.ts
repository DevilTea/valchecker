import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, isNonNull, null_, string, undefined_, union, unknown } from '../..'

const v = createValchecker({ steps: [isNonNull, null_, string, undefined_, union, unknown] })

describe('isNonNull step plugin', () => {
	it('removes null while preserving undefined', () => {
		const schema = v.union([v.string(), v.null(), v.undefined()])
			.isNonNull()
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<string | undefined>()
		expect(schema.execute(undefined))
			.toEqual({ value: undefined })
		expect(schema.execute(null))
			.toMatchObject({
				issues: [{ code: 'isNonNull:expected_non_null', payload: { value: null } }],
			})
	})

	it('narrows unknown output and supports custom messages', () => {
		const schema = v.unknown()
			.isNonNull({ message: 'Null forbidden' })
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<NonNullable<unknown> | undefined>()
		expect(schema.execute(undefined))
			.toEqual({ value: undefined })
		expect(schema.execute(null))
			.toMatchObject({ issues: [{ message: 'Null forbidden' }] })
	})

	it('is hidden when null is impossible', () => {
		if (false) {
			// @ts-expect-error isNonNull is unavailable when null is impossible
			v.string().isNonNull() // eslint-disable-line style/newline-per-chained-call -- single line keeps the directive covering the whole unreachable negative-type expression
		}
	})
})
