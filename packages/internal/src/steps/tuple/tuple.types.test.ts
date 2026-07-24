import type { InferIssue, InferOperationMode, InferOutput } from '../../core'
import { describe, expectTypeOf, it } from 'vitest'
import { array, boolean, createValchecker, number, string, toAsync, tuple, union } from '../..'

const v = createValchecker({
	steps: [tuple, array, boolean, number, string, toAsync, union],
})

const _empty = v.tuple([])
const _pair = v.tuple([v.string(), v.number()])
const _trailingRest = v.tuple([v.string(), '...', v.array(v.number())])
const _middleRest = v.tuple([v.string(), '...', v.array(v.boolean()), v.number()])
const _leadingRest = v.tuple(['...', v.array(v.boolean()), v.string()])
const _fixedSpread = v.tuple([v.string(), '...', v.tuple([v.number(), v.boolean()])])
const _asyncPrefix = v.tuple([v.string()
	.toAsync(), v.number()])
const _asyncOnlyRest = v.tuple([v.string(), '...', v.array(v.number()
	.toAsync())])
const _single = v.tuple([v.number()])

describe('tuple type-state output contracts', () => {
	it('maps fixed elements positionally and spreads rest regions like a TS tuple', () => {
		expectTypeOf<InferOutput<typeof _empty>>()
			.toEqualTypeOf<[]>()
		expectTypeOf<InferOutput<typeof _pair>>()
			.toEqualTypeOf<[string, number]>()
		expectTypeOf<InferOutput<typeof _trailingRest>>()
			.toEqualTypeOf<[string, ...number[]]>()
		expectTypeOf<InferOutput<typeof _middleRest>>()
			.toEqualTypeOf<[string, ...boolean[], number]>()
		expectTypeOf<InferOutput<typeof _leadingRest>>()
			.toEqualTypeOf<[...boolean[], string]>()
		expectTypeOf<InferOutput<typeof _fixedSpread>>()
			.toEqualTypeOf<[string, number, boolean]>()
		expectTypeOf<InferOutput<typeof _single>>()
			.toEqualTypeOf<[number]>()
	})

	it('reflects operation mode, including a rest-only async element', () => {
		expectTypeOf<InferOperationMode<typeof _pair>>()
			.toEqualTypeOf<'sync'>()
		expectTypeOf<InferOperationMode<typeof _asyncPrefix>>()
			.toEqualTypeOf<'maybe-async'>()
		expectTypeOf<InferOperationMode<typeof _asyncOnlyRest>>()
			.toEqualTypeOf<'maybe-async'>()
	})

	it('exposes owned length codes alongside element codes', () => {
		expectTypeOf<InferIssue<typeof _trailingRest>['code']>()
			.toEqualTypeOf<
				| 'tuple:expected_array'
				| 'tuple:unexpected_length'
				| 'tuple:expected_length_at_least'
				| 'array:expected_array'
				| 'string:expected_string'
				| 'number:expected_number'
				| 'core:unknown_exception'
				| 'core:message_exception'
		>()
	})
})

describe('tuple type-state availability and gating', () => {
	it('is available only as an initial schema step', () => {
		const current = v.string()
		if (false) {
			// @ts-expect-error tuple is unavailable after the output has been narrowed
			current.tuple([v.string()])
		}
	})

	it('rejects malformed element arrangements at compile time', () => {
		if (false) {
			// @ts-expect-error two rest markers are not allowed
			v.tuple([v.string(), '...', v.array(v.number()), '...', v.array(v.boolean())])
			// @ts-expect-error a trailing marker has no rest schema
			v.tuple([v.string(), '...'])
			// @ts-expect-error a rest schema must output an array
			v.tuple([v.string(), '...', v.number()])
		}
	})

	it('accepts as-const element arrays', () => {
		const _fromConst = v.tuple([v.string(), v.number()] as const)
		expectTypeOf<InferOutput<typeof _fromConst>>()
			.toEqualTypeOf<[string, number]>()
	})
})
