import type { InferIssue, InferOperationMode, InferOutput } from '../../core'
import { describe, expectTypeOf, it } from 'vitest'
import { createValchecker, map, number, string, toAsync, transform } from '../..'

const v = createValchecker({
	steps: [map, number, string, toAsync, transform],
})

describe('map type-state contracts', () => {
	it('infers transformed key/value output and synchronous operation mode', () => {
		const _schema = v.map({
			key: v.string()
				.transform(value => value.length),
			value: v.number()
				.transform(value => `${value}`),
		})

		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<Map<number, string>>()
		expectTypeOf<InferOperationMode<typeof _schema>>()
			.toEqualTypeOf<'sync'>()
		expectTypeOf<InferIssue<typeof _schema>['code']>()
			.toEqualTypeOf<
				| 'map:expected_map'
				| 'map:duplicate_transformed_key'
				| 'string:expected_string'
				| 'number:expected_number'
				| 'transform:callback_failed'
				| 'core:unknown_exception'
				| 'core:message_exception'
		>()
	})

	it('becomes maybe-async when either child schema is not fully synchronous', () => {
		const _keyAsync = v.map({
			key: v.string()
				.toAsync(),
			value: v.number(),
		})
		const _valueAsync = v.map({
			key: v.string(),
			value: v.number()
				.toAsync(),
		})

		expectTypeOf<InferOperationMode<typeof _keyAsync>>()
			.toEqualTypeOf<'maybe-async'>()
		expectTypeOf<InferOperationMode<typeof _valueAsync>>()
			.toEqualTypeOf<'maybe-async'>()
	})

	it('keeps message-handler issue codes and payloads linked', () => {
		v.map({
			key: v.string(),
			value: v.number(),
			message: (issue) => {
				if (issue.code === 'map:duplicate_transformed_key') {
					expectTypeOf(issue.payload.transformedKey)
						.toEqualTypeOf<string>()
				}
				if (issue.code === 'map:expected_map') {
					expectTypeOf(issue.payload.value)
						.toEqualTypeOf<unknown>()
				}
				if (issue.code === 'string:expected_string') {
					expectTypeOf(issue.payload.value)
						.toEqualTypeOf<unknown>()
				}
				if (issue.code === 'number:expected_number') {
					expectTypeOf(issue.payload.value)
						.toEqualTypeOf<unknown>()
				}
				return issue.code
			},
		})
	})

	it('is available only as an initial schema step', () => {
		const current = v.string()

		if (false) {
			// @ts-expect-error map is unavailable after output has already been narrowed
			current.map({ key: v.string(), value: v.number() })
		}
	})
})
