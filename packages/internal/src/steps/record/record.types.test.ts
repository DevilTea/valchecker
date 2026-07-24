import type { InferExecutionContext, InferIssue, InferOperationMode, InferOutput } from '../../core'
import { describe, expectTypeOf, it } from 'vitest'
import { as, bigint, boolean, check, createValchecker, isOneOf, literal, looseNumber, number, record, string, symbol, toAsync, union, unknown } from '../..'

const v = createValchecker({
	steps: [record, as, bigint, boolean, check, isOneOf, literal, looseNumber, number, string, symbol, toAsync, union, unknown],
})

const _stringKey = v.record({ key: v.string(), value: v.number() })
const _symbolKey = v.record({ key: v.symbol(), value: v.number() })
const _numberKey = v.record({ key: v.looseNumber(), value: v.number() })
const _unionKey = v.record({ key: v.union(['a', 'b']), value: v.number() })
const _literalKey = v.record({ key: v.literal('only'), value: v.number() })
const _isOneOfKey = v.record({ key: v.string()
	.isOneOf(['x', 'y']), value: v.number() })
const _numericUnionKey = v.record({ key: v.union([1, 2]), value: v.number() })
const _asyncKey = v.record({ key: v.string(), value: v.number()
	.toAsync() })
const _nonFinite = v.record({ key: v.string(), value: v.number() })
const _finite = v.record({ key: v.union(['a', 'b']), value: v.number() })

describe('record type-state output contracts', () => {
	it('produces an open index signature for wide key domains', () => {
		expectTypeOf<InferOutput<typeof _stringKey>>()
			.toEqualTypeOf<Record<string, number>>()
		expectTypeOf<InferOutput<typeof _symbolKey>>()
			.toEqualTypeOf<Record<symbol, number>>()
		expectTypeOf<InferOutput<typeof _numberKey>>()
			.toEqualTypeOf<Record<number, number>>()
	})

	it('produces an all-required mapped object for finite key domains', () => {
		expectTypeOf<InferOutput<typeof _unionKey>>()
			.toEqualTypeOf<{ a: number, b: number }>()
		expectTypeOf<InferOutput<typeof _literalKey>>()
			.toEqualTypeOf<{ only: number }>()
		expectTypeOf<InferOutput<typeof _isOneOfKey>>()
			.toEqualTypeOf<{ x: number, y: number }>()
		expectTypeOf<InferOutput<typeof _numericUnionKey>>()
			.toEqualTypeOf<{ 1: number, 2: number }>()
	})

	it('reflects operation mode from key and value schemas', () => {
		expectTypeOf<InferOperationMode<typeof _stringKey>>()
			.toEqualTypeOf<'sync'>()
		expectTypeOf<InferOperationMode<typeof _asyncKey>>()
			.toEqualTypeOf<'maybe-async'>()
	})
})

describe('record type-state issue contracts', () => {
	it('exposes non-finite self and child codes', () => {
		expectTypeOf<InferIssue<typeof _nonFinite>['code']>()
			.toEqualTypeOf<
				| 'record:expected_object'
				| 'record:duplicate_transformed_key'
				| 'string:expected_string'
				| 'number:expected_number'
				| 'core:unknown_exception'
				| 'core:message_exception'
		>()
	})

	it('exposes finite self codes and never the key-execution codes', () => {
		expectTypeOf<InferIssue<typeof _finite>['code']>()
			.toEqualTypeOf<
				| 'record:expected_object'
				| 'record:missing_key'
				| 'record:unexpected_keys'
				| 'number:expected_number'
				| 'core:unknown_exception'
				| 'core:message_exception'
		>()
	})
})

describe('record type-state availability and gating', () => {
	it('is available only as an initial schema step', () => {
		const current = v.string()
		if (false) {
			// @ts-expect-error record is unavailable after the output has been narrowed
			current.record({ key: v.string(), value: v.number() })
		}
	})

	it('rejects incoherent key schemas at compile time', () => {
		if (false) {
			// @ts-expect-error a literal-union key without runtime members cannot drive exhaustiveness
			v.record({ key: v.as<'a' | 'b'>(), value: v.number() })
			// @ts-expect-error boolean output is not a property key
			v.record({ key: v.boolean(), value: v.number() })
			// @ts-expect-error bigint output is not a property key
			v.record({ key: v.literal(1n), value: v.number() })
			// @ts-expect-error unknown output is not a coherent key domain
			v.record({ key: v.unknown(), value: v.number() })
			// @ts-expect-error literal(NaN) output widens to number, which is not all-literal with members
			v.record({ key: v.literal(Number.NaN), value: v.number() })
		}
	})
})

describe('record literalMembers provider coherence', () => {
	it('advertises the exact members of an identity literal schema', () => {
		expectTypeOf<InferExecutionContext<ReturnType<typeof v.literal<'a'>>>['literalMembers']>()
			.toEqualTypeOf<readonly ['a']>()
	})

	it('drops members after a non-identity step chains', () => {
		const _chained = v.literal('a')
			.check(() => true)
		expectTypeOf<InferExecutionContext<typeof _chained>['literalMembers']>()
			.toEqualTypeOf<undefined>()
	})

	it('combines members across a union of literals but drops them when any branch is open', () => {
		const _literals = v.union(['a', 'b'])
		const _withString = v.union([v.string(), 'a'])
		expectTypeOf<InferExecutionContext<typeof _literals>['literalMembers']>()
			.toEqualTypeOf<readonly ('a' | 'b')[]>()
		expectTypeOf<InferExecutionContext<typeof _withString>['literalMembers']>()
			.toEqualTypeOf<undefined>()
	})
})
