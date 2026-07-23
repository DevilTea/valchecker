import type { InferOutput } from '../../core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, map, number, string, toEntries } from '../..'

const v = createValchecker({ steps: [map, number, string, toEntries] })

describe('toEntries step plugin', () => {
	it('returns Map entries in insertion order as new tuple arrays', () => {
		const input = new Map([['b', 2], ['a', 1]])
		const result = v.map({ key: v.string(), value: v.number() })
			.toEntries()
			.execute(input)

		expect(result)
			.toEqual({ value: [['b', 2], ['a', 1]] })
		expect((result as { value: Array<[string, number]> }).value[0]).not.toBe([...input.entries()][0])
		expect(input)
			.toEqual(new Map([['b', 2], ['a', 1]]))
	})

	it('infers mutable key-value tuples', () => {
		const _schema = v.map({ key: v.string(), value: v.number() })
			.toEntries()
		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<Array<[string, number]>>()
	})
})
