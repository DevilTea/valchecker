import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, isNonNullish, null_, string, undefined_, union, unknown } from '../..'

const v = createValchecker({ steps: [isNonNullish, null_, string, undefined_, union, unknown] })

describe('isNonNullish step plugin', () => {
	it('removes both null and undefined', () => {
		const schema = v.union([v.string(), v.null(), v.undefined()]).isNonNullish()
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<string>()
		expect(schema.execute('value')).toEqual({ value: 'value' })
		expect(schema.execute(null)).toMatchObject({ issues: [{ code: 'isNonNullish:expected_non_nullish' }] })
		expect(schema.execute(undefined)).toMatchObject({ issues: [{ code: 'isNonNullish:expected_non_nullish' }] })
	})

	it('supports unknown input and custom messages', () => {
		expect(v.unknown().isNonNullish({ message: 'Value required' }).execute(null)).toMatchObject({
			issues: [{ message: 'Value required' }],
		})
	})

	it('is hidden when nullish values are impossible', () => {
		expectTypeOf(v.string().isNonNullish).toBeNever()
	})
})
