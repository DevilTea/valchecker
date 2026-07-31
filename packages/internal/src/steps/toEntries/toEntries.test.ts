import type { InferOutput } from '../../core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, map, number, set, string, toEntries } from '../..'

const v = createValchecker({ steps: [map, number, set, string, toEntries] })

describe('toEntries step plugin', () => {
	it('returns Map entries in insertion order as new tuple arrays', () => {
		const input = new Map([['b', 2], ['a', 1]])
		const schema = v.map({ key: v.string(), value: v.number() })
			.toEntries()
		const first = schema.execute(input) as { value: Array<[string, number]> }
		const second = schema.execute(input) as { value: Array<[string, number]> }

		expect(first)
			.toEqual({ value: [['b', 2], ['a', 1]] })
		// Every run allocates its own outer array and its own tuples, so writing
		// through one result is observable in neither another run nor the source Map.
		expect(second.value).not.toBe(first.value)
		expect(second.value[0]).not.toBe(first.value[0])
		first.value[0]![1] = 99
		expect(second.value[0])
			.toEqual(['b', 2])
		expect(input)
			.toEqual(new Map([['b', 2], ['a', 1]]))
	})

	it('infers mutable key-value tuples and is unavailable outside a Map output', () => {
		const _schema = v.map({ key: v.string(), value: v.number() })
			.toEntries()
		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<Array<[string, number]>>()
		if (false) {
			// @ts-expect-error toEntries is unavailable when the output is not a Map
			v.set(v.string()).toEntries() // eslint-disable-line style/newline-per-chained-call -- single line keeps the directive covering the whole unreachable negative-type expression
		}
	})
})
