import type { InferIssue, InferOperationMode, InferOutput } from '../../core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, set, string, toArray } from '../..'

const v = createValchecker({ steps: [set, string, toArray] })

describe('toArray step plugin', () => {
	it('returns Set items in insertion order as a new array', () => {
		const input = new Set(['b', 'a'])
		const result = v.set(v.string()).toArray().execute(input)

		expect(result).toEqual({ value: ['b', 'a'] })
		expect((result as { value: string[] }).value).not.toBe(input)
		expect(input).toEqual(new Set(['b', 'a']))
	})

	it('infers an issue-free synchronous item array', () => {
		const schema = v.set(v.string()).toArray()
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<string[]>()
		expectTypeOf<InferIssue<typeof schema>['code']>().toEqualTypeOf<'set:expected_set' | 'set:duplicate_transformed_item' | 'string:expected_string'>()
		expectTypeOf<InferOperationMode<typeof schema>>().toEqualTypeOf<'sync'>()
	})
})
