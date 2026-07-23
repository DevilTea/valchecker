import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, isOneOf, number, object, string, unknown } from '../..'

const v = createValchecker({ steps: [isOneOf, number, object, string, unknown] })

describe('isOneOf step plugin', () => {
	it('accepts configured values with Object.is semantics', () => {
		expect(v.number()
			.isOneOf([Number.NaN, -0])
			.execute(Number.NaN))
			.toEqual({ value: Number.NaN })
		expect(v.number()
			.isOneOf([-0])
			.execute(0))
			.toMatchObject({ issues: [{ code: 'isOneOf:expected_one_of' }] })
	})

	it('narrows output and snapshots configured values', () => {
		const values: ['draft', 'published'] = ['draft', 'published']
		const schema = v.unknown()
			.isOneOf(values)
		// Mutate the source array after registration to prove isOneOf snapshots it.
		;(values as string[])[0] = 'published'
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<'draft' | 'published'>()
		expect(schema.execute('draft'))
			.toEqual({ value: 'draft' })

		const failure = schema.execute('other') as any
		expect(failure)
			.toMatchObject({
				issues: [{ payload: { expectedValues: ['draft', 'published'] } }],
			})
		expect(() => failure.issues[0].payload.expectedValues.push('other'))
			.toThrow()
	})

	it('reports custom messages and enforces non-empty primitive tuples', () => {
		expect(v.string()
			.isOneOf(['a', 'b'], { message: 'Allowed value required' })
			.execute('c'))
			.toMatchObject({
				issues: [{
					message: 'Allowed value required',
					payload: { value: 'c', expectedValues: ['a', 'b'] },
				}],
			})
		if (false) {
			// @ts-expect-error At least one configured value is required.
			v.string().isOneOf([]) // eslint-disable-line style/newline-per-chained-call -- single line keeps the directive covering the whole unreachable negative-type expression
		}
		expect(() => v.string()
			.isOneOf([] as any))
			.toThrow('at least one')
		if (false) {
			// @ts-expect-error isOneOf is unavailable for object-only output
			v.object({}).isOneOf([]) // eslint-disable-line style/newline-per-chained-call -- single line keeps the directive covering the whole unreachable negative-type expression
		}
	})
})
