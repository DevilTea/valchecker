import type { InferIssue, InferOutput } from '../core'
import { describe, expectTypeOf, it } from 'vitest'
import {
	array,
	createValchecker,
	isEmpty,
	isIncluding,
	isIncludingKey,
	isIncludingValue,
	isNotEmpty,
	isSizeAtLeast,
	isSizeAtMost,
	isSizeExactly,
	map,
	number,
	set,
	string,
	toSize,
} from '.'

const v = createValchecker({
	steps: [
		array,
		isEmpty,
		isIncluding,
		isIncludingKey,
		isIncludingValue,
		isNotEmpty,
		isSizeAtLeast,
		isSizeAtMost,
		isSizeExactly,
		map,
		number,
		set,
		string,
		toSize,
	],
})

describe('collection size and membership type-state contracts', () => {
	it('preserves collection outputs through validations and returns number from toSize', () => {
		const setSchema = v.set(v.string())
			.isNotEmpty()
			.isSizeAtLeast(1)
			.isSizeAtMost(3)
			.isSizeExactly(2)
			.isIncluding('required')
		const mapSchema = v.map({ key: v.string(), value: v.number() })
			.isEmpty()
			.isIncludingKey('key')
			.isIncludingValue(1)

		expectTypeOf<InferOutput<typeof setSchema>>().toEqualTypeOf<Set<string>>()
		expectTypeOf<InferOutput<typeof mapSchema>>().toEqualTypeOf<Map<string, number>>()
		expectTypeOf<InferOutput<ReturnType<typeof mapSchema.toSize>>>().toEqualTypeOf<number>()
	})

	it('keeps length and size payload variants precise', () => {
		const stringSchema = v.string().isEmpty()
		const setSchema = v.set(v.string()).isNotEmpty()

		expectTypeOf<Extract<InferIssue<typeof stringSchema>, { code: 'isEmpty:expected_empty' }>['payload']>()
			.toEqualTypeOf<{ value: string, length: number }>()
		expectTypeOf<Extract<InferIssue<typeof setSchema>, { code: 'isNotEmpty:expected_not_empty' }>['payload']>()
			.toEqualTypeOf<{ value: Set<string>, size: number }>()
	})

	it('restricts membership operands to collection generic types', () => {
		const setSchema = v.set(v.string())
		const mapSchema = v.map({ key: v.string(), value: v.number() })

		setSchema.isIncluding('value')
		mapSchema.isIncludingKey('key')
		mapSchema.isIncludingValue(1)

		if (false) {
			// @ts-expect-error Set item type is string
			setSchema.isIncluding(1)
			// @ts-expect-error Map key type is string
			mapSchema.isIncludingKey(1)
			// @ts-expect-error Map value type is number
			mapSchema.isIncludingValue('value')
			// @ts-expect-error Map membership is intentionally explicit about keys versus values
			mapSchema.isIncluding('value')
			// @ts-expect-error array values have length, not size
			v.array(v.string()).isSizeAtLeast(1)
			// @ts-expect-error strings have length, not size
			v.string().toSize()
		}
	})
})
