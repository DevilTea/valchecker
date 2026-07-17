import type { InferIssue, InferOperationMode, InferOutput } from '../../core'
import { describe, expectTypeOf, it } from 'vitest'
import { createValchecker, number, string, transform, union } from '../..'

const v = createValchecker({ steps: [number, string, transform, union] })

describe('union type-state contracts', () => {
	it('infers the union of branch outputs and issues for synchronous branches', () => {
		const schema = v.union([v.string(), v.number()])

		expectTypeOf<InferOperationMode<typeof schema>>().toEqualTypeOf<'sync'>()
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<string | number>()
		expectTypeOf<InferIssue<typeof schema>['code']>()
			.toEqualTypeOf<'string:expected_string' | 'number:expected_number'>()
	})

	it('becomes maybe-async when any branch can return a promise', () => {
		const schema = v.union([
			v.string().transform(async value => value.toUpperCase()),
			v.number(),
		])

		expectTypeOf<InferOperationMode<typeof schema>>().toEqualTypeOf<'maybe-async'>()
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<string | number>()
	})
})
