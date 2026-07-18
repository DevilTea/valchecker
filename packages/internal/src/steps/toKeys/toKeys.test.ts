import type { InferOutput } from '../../core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, map, number, string, toKeys } from '../..'

const v = createValchecker({ steps: [map, number, string, toKeys] })

describe('toKeys step plugin', () => {
	it('returns Map keys in insertion order as a new array', () => {
		const input = new Map([['b', 2], ['a', 1]])
		const result = v.map({ key: v.string(), value: v.number() }).toKeys().execute(input)

		expect(result).toEqual({ value: ['b', 'a'] })
		expect(input).toEqual(new Map([['b', 2], ['a', 1]]))
	})

	it('infers the Map key array', () => {
		const schema = v.map({ key: v.string(), value: v.number() }).toKeys()
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<string[]>()
	})
})
