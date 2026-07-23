import type { InferIssue, InferOperationMode, InferOutput } from '../core'
import { describe, expectTypeOf, it } from 'vitest'
import {
	any,
	array,
	map,
	number,
	set,
	string,
	toFiltered,
	toMapped,
	toMappedKeys,
	toMappedValues,
} from '.'
import { createValchecker } from '../core'

const v = createValchecker({
	steps: [
		any,
		array,
		map,
		number,
		set,
		string,
		toFiltered,
		toMapped,
		toMappedKeys,
		toMappedValues,
	],
})

describe('collection callback transform type-state contracts', () => {
	it('infers Set mapping and filtering outputs', () => {
		const _mapped = v.set(v.string())
			.toMapped(item => item.length)
		const _filtered = v.set(v.any())
			.toFiltered((item): item is string => typeof item === 'string')

		expectTypeOf<InferOutput<typeof _mapped>>()
			.toEqualTypeOf<Set<number>>()
		expectTypeOf<InferOutput<typeof _filtered>>()
			.toEqualTypeOf<Set<string>>()
		expectTypeOf<InferOperationMode<typeof _mapped>>()
			.toEqualTypeOf<'sync'>()
		expectTypeOf<InferIssue<typeof _mapped>['code']>()
			.toEqualTypeOf<
				| 'set:expected_set'
				| 'set:duplicate_transformed_item'
				| 'string:expected_string'
				| 'toMapped:callback_failed'
				| 'toMapped:duplicate_mapped_item'
				| 'core:unknown_exception'
				| 'core:message_exception'
		>()
	})

	it('infers Map value and key mapping outputs', () => {
		const _mappedValues = v.map({ key: v.string(), value: v.number() })
			.toMappedValues(value => `${value}`)
		const _mappedKeys = v.map({ key: v.string(), value: v.number() })
			.toMappedKeys(key => key.length)

		expectTypeOf<InferOutput<typeof _mappedValues>>()
			.toEqualTypeOf<Map<string, string>>()
		expectTypeOf<InferOutput<typeof _mappedKeys>>()
			.toEqualTypeOf<Map<number, number>>()
		expectTypeOf<InferOperationMode<typeof _mappedValues>>()
			.toEqualTypeOf<'sync'>()
		expectTypeOf<InferOperationMode<typeof _mappedKeys>>()
			.toEqualTypeOf<'sync'>()
	})

	it('keeps message-handler issue payload variants linked to mapper output', () => {
		v.set(v.string())
			.toMapped(item => item.length, {
				message: (issue) => {
					if (issue.code === 'toMapped:callback_failed') {
						expectTypeOf(issue.payload.item)
							.toEqualTypeOf<string>()
					}
					if (issue.code === 'toMapped:duplicate_mapped_item') {
						expectTypeOf(issue.payload.mappedItem)
							.toEqualTypeOf<number>()
					}
					return issue.code
				},
			})

		v.map({ key: v.string(), value: v.number() })
			.toMappedKeys(key => key.length, {
				message: (issue) => {
					if (issue.code === 'toMappedKeys:callback_failed') {
						expectTypeOf(issue.payload.key)
							.toEqualTypeOf<string>()
						expectTypeOf(issue.payload.entryValue)
							.toEqualTypeOf<number>()
					}
					if (issue.code === 'toMappedKeys:duplicate_mapped_key') {
						expectTypeOf(issue.payload.mappedKey)
							.toEqualTypeOf<number>()
					}
					return issue.code
				},
			})
	})

	it('keeps callback transforms restricted to their intended collection kinds', () => {
		const arraySchema = v.array(v.string())
		const setSchema = v.set(v.string())
		const mapSchema = v.map({ key: v.string(), value: v.number() })

		arraySchema.toMapped(item => item.length)
		arraySchema.toFiltered(item => item.length > 0)
		setSchema.toMapped(item => item.length)
		setSchema.toFiltered(item => item.length > 0)
		mapSchema.toMappedKeys(key => key.length)
		mapSchema.toMappedValues(value => `${value}`)

		if (false) {
			// @ts-expect-error Map filtering is intentionally out of scope
			mapSchema.toFiltered(() => true)
			// @ts-expect-error Set values do not expose Map key mapping
			setSchema.toMappedKeys(item => item)
			// @ts-expect-error arrays do not expose Map value mapping
			arraySchema.toMappedValues(item => item)
		}
	})
})
