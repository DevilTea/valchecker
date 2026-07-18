import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, isNonNull, null_, string, undefined_, union, unknown } from '../..'

const v = createValchecker({ steps: [isNonNull, null_, string, undefined_, union, unknown] })

describe('isNonNull step plugin', () => {
	it('removes null while preserving undefined', () => {
		const schema = v.union([v.string(), v.null(), v.undefined()]).isNonNull()
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<string | undefined>()
		expect(schema.execute(undefined)).toEqual({ value: undefined })
		expect(schema.execute(null)).toMatchObject({ issues: [{ code: 'isNonNull:expected_non_null' }] })
	})

	it('supports unknown input and custom messages', () => {
		expect(v.unknown().isNonNull({ message: 'Null forbidden' }).execute(null)).toMatchObject({
			issues: [{ message: 'Null forbidden' }],
		})
	})

	it('is hidden when null is impossible', () => {
		expectTypeOf(v.string().isNonNull).toBeNever()
	})
})
