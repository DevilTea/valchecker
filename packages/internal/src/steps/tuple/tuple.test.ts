import { describe, expect, expectTypeOf, it } from 'vitest'
import type { InferOutput } from '../../core'
import { createValchecker } from '../../core'
import { number } from '../number'
import { string } from '../string'
import { toAsync } from '../toAsync'
import { tuple } from '.'

const v = createValchecker({ steps: [tuple, string, number, toAsync] })

describe('tuple step plugin', () => {
	it('validates exact fixed tuples without stripping', () => {
		const schema = v.tuple([v.string(), v.number()] as const)
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<[string, number]>()
		expect(schema.execute(['a', 1])).toEqual({ value: ['a', 1] })
		expect(schema.execute(['a'])).toMatchObject({ issues: [{ code: 'tuple:expected_length' }] })
		expect(schema.execute(['a', 1, 2])).toMatchObject({ issues: [{ code: 'tuple:expected_length' }] })
	})

	it('supports variadic rest items', () => {
		const schema = v.tuple([v.string()] as const, v.number())
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<[string, ...number[]]>()
		expect(schema.execute(['a', 1, 2])).toEqual({ value: ['a', 1, 2] })
		expect(schema.execute([])).toMatchObject({ issues: [{ code: 'tuple:expected_length' }] })
	})

	it('prepends child indexes and preserves maybe-async execution', async () => {
		expect(v.tuple([v.string(), v.number()] as const).execute(['a', 'x'])).toMatchObject({ issues: [{ path: [1] }] })
		expect(await v.tuple([v.string().toAsync()] as const).execute(['a'])).toEqual({ value: ['a'] })
		expect(await v.tuple([v.string().toAsync(), v.number()] as const).execute(['a', 'x'])).toMatchObject({ issues: [{ path: [1] }] })
	})

	it('rejects non-arrays and supports custom messages', () => {
		expect(v.tuple([], 'Tuple required').execute({})).toMatchObject({ issues: [{ code: 'tuple:expected_array', message: 'Tuple required' }] })
	})
})
