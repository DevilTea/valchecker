import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, isEqualTo, number, object, string, union, unknown } from '../..'

const v = createValchecker({ steps: [isEqualTo, number, object, string, union, unknown] })

describe('isEqualTo step plugin', () => {
	it('uses Object.is semantics', () => {
		expect(v.number().isEqualTo(Number.NaN).execute(Number.NaN)).toEqual({ value: Number.NaN })
		expect(v.number().isEqualTo(-0).execute(0)).toMatchObject({ issues: [{ code: 'isEqualTo:expected_equal_to' }] })
	})

	it('narrows primitive and mixed-union output', () => {
		const schema = v.union([v.string(), v.number()]).isEqualTo('ready')
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<'ready'>()
		expect(schema.execute('ready')).toEqual({ value: 'ready' })
		expect(schema.execute(1)).toMatchObject({ issues: [{ code: 'isEqualTo:expected_equal_to' }] })
	})

	it('is available after unknown but unavailable for object-only output', () => {
		const schema = v.unknown().isEqualTo(true, { message: 'Expected true' })
		expect(schema.execute(false)).toMatchObject({ issues: [{ message: 'Expected true' }] })
		expectTypeOf(v.object({}).isEqualTo).toBeNever()
	})
})
