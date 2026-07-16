import { describe, expect, expectTypeOf, it } from 'vitest'
import type { InferOutput } from '../../core'
import { createValchecker } from '../../core'
import { picklist } from '.'

const v = createValchecker({ steps: [picklist] })

describe('picklist step plugin', () => {
	it('accepts configured literals and infers their union', () => {
		const schema = v.picklist(['draft', 'published', null] as const)
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<'draft' | 'published' | null>()
		expect(schema.execute('draft')).toEqual({ value: 'draft' })
		expect(schema.execute(null)).toEqual({ value: null })
	})

	it('rejects values outside the picklist', () => {
		expect(v.picklist(['a', 'b'] as const).execute('c')).toEqual({
			issues: [{
				code: 'picklist:expected_value',
				message: 'Expected one of the allowed literal values.',
				path: [],
				payload: { value: 'c', expected: ['a', 'b'] },
			}],
		})
	})

	it('uses a custom message', () => {
		expect(v.picklist([1, 2] as const, 'Not allowed').execute(3)).toMatchObject({ issues: [{ message: 'Not allowed' }] })
	})
})
