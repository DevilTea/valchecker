import { describe, expect, expectTypeOf, it } from 'vitest'
import type { InferOutput } from '../../core'
import { createValchecker } from '../../core'
import { string } from '../string'
import { toAsync } from '../toAsync'
import { transform } from '../transform'
import { set } from '.'

const v = createValchecker({ steps: [set, string, toAsync, transform] })

describe('set step plugin', () => {
	it('validates and transforms set items asynchronously', async () => {
		const schema = v.set(v.string().transform(value => value.toUpperCase()).toAsync())
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<Set<string>>()
		expect(await schema.execute(new Set(['a', 'b']))).toEqual({ value: new Set(['A', 'B']) })
		expect(await schema.execute(new Set(['a', 1]))).toMatchObject({ issues: [{ path: [1] }] })
	})

	it('preserves fully synchronous collection execution', () => {
		const schema = v.set(v.string())
		expect(schema.execute(new Set(['a', 'b']))).toEqual({ value: new Set(['a', 'b']) })
		expect(schema.execute(new Set(['a', 1]))).toMatchObject({ issues: [{ path: [1] }] })
	})

	it('rejects non-sets and supports custom messages', () => {
		expect(v.set(v.string(), 'Set required').execute([])).toMatchObject({ issues: [{ code: 'set:expected_set', message: 'Set required' }] })
	})
})
