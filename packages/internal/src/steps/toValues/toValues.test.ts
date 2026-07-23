import type { InferOutput } from '../../core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, map, number, string, toValues } from '../..'

const v = createValchecker({ steps: [map, number, string, toValues] })

describe('toValues step plugin', () => {
	it('returns Map values in insertion order as a new array', () => {
		const input = new Map([['b', 2], ['a', 1]])
		const result = v.map({ key: v.string(), value: v.number() })
			.toValues()
			.execute(input)

		expect(result)
			.toEqual({ value: [2, 1] })
		expect(input)
			.toEqual(new Map([['b', 2], ['a', 1]]))
	})

	it('infers the Map value array', () => {
		const _schema = v.map({ key: v.string(), value: v.number() })
			.toValues()
		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<number[]>()
	})
})
