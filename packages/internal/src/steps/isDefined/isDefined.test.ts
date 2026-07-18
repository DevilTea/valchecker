import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, isDefined, null_, string, undefined_, union, unknown } from '../..'

const v = createValchecker({ steps: [isDefined, null_, string, undefined_, union, unknown] })

describe('isDefined step plugin', () => {
	it('removes undefined while preserving null', () => {
		const schema = v.union([v.string(), v.null(), v.undefined()]).isDefined()
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<string | null>()
		expect(schema.execute(null)).toEqual({ value: null })
		expect(schema.execute(undefined)).toMatchObject({
			issues: [{ code: 'isDefined:expected_defined', payload: { value: undefined } }],
		})
	})

	it('narrows unknown output and supports custom messages', () => {
		const schema = v.unknown().isDefined({ message: 'Required' })
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<NonNullable<unknown> | null>()
		expect(schema.execute(null)).toEqual({ value: null })
		expect(schema.execute(undefined)).toMatchObject({ issues: [{ message: 'Required' }] })
	})

	it('is hidden when undefined is impossible', () => {
		expectTypeOf(v.string().isDefined).toBeNever()
	})
})
