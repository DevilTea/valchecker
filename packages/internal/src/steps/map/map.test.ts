import { describe, expect, expectTypeOf, it } from 'vitest'
import type { InferOutput } from '../../core'
import { createValchecker } from '../../core'
import { number } from '../number'
import { string } from '../string'
import { toAsync } from '../toAsync'
import { transform } from '../transform'
import { map } from '.'

const v = createValchecker({ steps: [map, number, string, toAsync, transform] })

describe('map step plugin', () => {
	it('validates and transforms keys and values', async () => {
		const schema = v.map(v.string().transform(value => value.toUpperCase()), v.number().toAsync())
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<Map<string, number>>()
		expect(await schema.execute(new Map([['a', 1]]))).toEqual({ value: new Map([['A', 1]]) })
		expect(await schema.execute(new Map([[1, 'x']]))).toMatchObject({ issues: [{ path: [0, 'key'] }, { path: [0, 'value'] }] })
	})

	it('preserves fully synchronous collection execution', () => {
		const schema = v.map(v.string(), v.number())
		expect(schema.execute(new Map([['a', 1]]))).toEqual({ value: new Map([['a', 1]]) })
		expect(schema.execute(new Map([[1, 'x']]))).toMatchObject({ issues: [{ path: [0, 'key'] }, { path: [0, 'value'] }] })
	})

	it('continues sequentially after an asynchronous key', async () => {
		const schema = v.map(v.string().toAsync(), v.number())
		expect(await schema.execute(new Map([['a', 1], ['b', 2]]))).toEqual({ value: new Map([['a', 1], ['b', 2]]) })
	})

	it('rejects non-maps and supports custom messages', () => {
		expect(v.map(v.string(), v.number(), 'Map required').execute({})).toMatchObject({ issues: [{ code: 'map:expected_map', message: 'Map required' }] })
	})
})
