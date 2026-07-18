import type { InferIssue, InferOperationMode, InferOutput } from '../../core'
import { describe, expectTypeOf, it } from 'vitest'
import { createValchecker, set, string, toAsync, transform } from '../..'

const v = createValchecker({
	steps: [set, string, toAsync, transform],
})

describe('set type-state contracts', () => {
	it('infers transformed item output and synchronous operation mode', () => {
		const schema = v.set(v.string().transform(value => value.length))

		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<Set<number>>()
		expectTypeOf<InferOperationMode<typeof schema>>().toEqualTypeOf<'sync'>()
		expectTypeOf<InferIssue<typeof schema>['code']>().toEqualTypeOf<
			| 'set:expected_set'
			| 'set:duplicate_transformed_item'
			| 'string:expected_string'
			| 'transform:callback_failed'
		>()
	})

	it('becomes maybe-async when the item schema is not fully synchronous', () => {
		const schema = v.set(v.string().toAsync())

		expectTypeOf<InferOperationMode<typeof schema>>().toEqualTypeOf<'maybe-async'>()
	})

	it('keeps message-handler issue codes and payloads linked', () => {
		v.set(v.string(), {
			message: (issue) => {
				if (issue.code === 'set:duplicate_transformed_item')
					expectTypeOf(issue.payload.transformedItem).toEqualTypeOf<string>()
				if (issue.code === 'set:expected_set')
					expectTypeOf(issue.payload.value).toEqualTypeOf<unknown>()
				if (issue.code === 'string:expected_string')
					expectTypeOf(issue.payload.value).toEqualTypeOf<unknown>()
				return issue.code
			},
		})
	})

	it('is available only as an initial schema step', () => {
		const current = v.string()

		if (false) {
			// @ts-expect-error set is unavailable after output has already been narrowed
			current.set(v.string())
		}
	})
})
