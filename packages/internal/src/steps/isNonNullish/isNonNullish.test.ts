import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, isNonNullish, null_, string, undefined_, union, unknown } from '../..'

const v = createValchecker({ steps: [isNonNullish, null_, string, undefined_, union, unknown] })

describe('isNonNullish step plugin', () => {
	it('removes both null and undefined', () => {
		const schema = v.union([v.string(), v.null(), v.undefined()])
			.isNonNullish()
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<string>()
		expect(schema.execute('value'))
			.toEqual({ value: 'value' })
		expect(schema.execute(null))
			.toMatchObject({ issues: [{ code: 'isNonNullish:expected_non_nullish' }] })
		expect(schema.execute(undefined))
			.toMatchObject({ issues: [{ code: 'isNonNullish:expected_non_nullish' }] })
	})

	it('narrows unknown output and supports custom messages', () => {
		const schema = v.unknown()
			.isNonNullish({ message: 'Value required' })
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<NonNullable<unknown>>()
		expect(schema.execute('value'))
			.toEqual({ value: 'value' })
		expect(schema.execute(null))
			.toMatchObject({ issues: [{ message: 'Value required' }] })
		expect(schema.execute(undefined))
			.toMatchObject({
				issues: [{ payload: { value: undefined } }],
			})
	})

	it('is hidden when nullish values are impossible', () => {
		if (false) {
			// @ts-expect-error isNonNullish is unavailable when nullish values are impossible
			v.string().isNonNullish() // eslint-disable-line style/newline-per-chained-call -- single line keeps the directive covering the whole unreachable negative-type expression
		}
	})
})
