import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, isOneOf, number, object, string, unknown } from '../..'

const v = createValchecker({ steps: [isOneOf, number, object, string, unknown] })

describe('isOneOf step plugin', () => {
	it('accepts configured values with Object.is semantics', () => {
		expect(v.number().isOneOf([Number.NaN, -0]).execute(Number.NaN)).toEqual({ value: Number.NaN })
		expect(v.number().isOneOf([-0]).execute(0)).toMatchObject({ issues: [{ code: 'isOneOf:expected_one_of' }] })
	})

	it('narrows output to the configured literal union and snapshots values', () => {
		const values = ['draft', 'published'] as const
		const schema = v.unknown().isOneOf(values)
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<'draft' | 'published'>()
		expect(schema.execute('draft')).toEqual({ value: 'draft' })
	})

	it('reports configured values, custom messages, and invalid empty configuration', () => {
		expect(v.string().isOneOf(['a', 'b'], { message: 'Allowed value required' }).execute('c')).toMatchObject({
			issues: [{
				message: 'Allowed value required',
				payload: { value: 'c', expectedValues: ['a', 'b'] },
			}],
		})
		expect(() => v.string().isOneOf([])).toThrow('at least one')
		expectTypeOf(v.object({}).isOneOf).toBeNever()
	})
})
