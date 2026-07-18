import { describe, expect, expectTypeOf, it } from 'vitest'
import type { InferOutput } from '../../core'
import { createValchecker, map, number, set, string, toSize } from '../..'

const v = createValchecker({ steps: [map, number, set, string, toSize] })

describe('toSize step plugin', () => {
	it('returns Map and Set sizes without mutating the source value', () => {
		const setValue = new Set(['a', 'b'])
		const mapValue = new Map([['a', 1]])
		expect(v.set(v.string()).toSize().execute(setValue)).toEqual({ value: 2 })
		expect(v.map({ key: v.string(), value: v.number() }).toSize().execute(mapValue)).toEqual({ value: 1 })
		expect(setValue).toEqual(new Set(['a', 'b']))
		expect(mapValue).toEqual(new Map([['a', 1]]))
	})

	it('infers number output', () => {
		const schema = v.set(v.string()).toSize()
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<number>()
	})
})
