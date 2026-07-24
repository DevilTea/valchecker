import type { InferIssue, InferOperationMode, InferOutput } from '../../core'
import { describe, expectTypeOf, it } from 'vitest'
import { bigint, boolean, createValchecker, literal, null_, number, object, string, templateLiteral, undefined_, union } from '../..'

// The main instance deliberately omits `null_`/`undefined_`: registering them
// makes `union([...literals])` output additionally include `null | undefined`
// (a pre-existing union shorthand-resolution behavior), which would pollute the
// cross-product assertions. A separate nullish instance covers the `null`/
// `undefined` schema-part row, where those values come from schemas, not union
// shorthands, so no pollution occurs.
const v = createValchecker({
	steps: [templateLiteral, string, number, bigint, boolean, literal, union, object],
})

const vNullish = createValchecker({
	steps: [templateLiteral, string, null_, undefined_],
})

// Type-level membership probe: is `S` a member of the assembled output type `O`?
type IsMember<S extends string, O> = S extends O ? true : false

// Schema factories keep the inferred generic literal parts intact for InferOutput
// probes, and isolate each call in its own inference context.
function _idNumber() {
	return v.templateLiteral(['ID-', v.number()])
}
function _numberUnit() {
	return v.templateLiteral([v.number(), v.union(['px', 'em', 'rem'])])
}
function _crossProduct() {
	return v.templateLiteral([v.union(['a', 'b']), '-', v.union([1, 2])])
}
function _twoStrings() {
	return v.templateLiteral([v.string(), '@', v.string()])
}
function _versioned() {
	return v.templateLiteral(['v', v.bigint()])
}
function _isBoolean() {
	return v.templateLiteral(['is:', v.boolean()])
}
function _nullUndefined() {
	return vNullish.templateLiteral([vNullish.null(), '/', vNullish.undefined()])
}
function _allLiterals() {
	return v.templateLiteral(['#', 1, true, 2n, null, undefined])
}
function _empty() {
	return v.templateLiteral([])
}
function _singleString() {
	return v.templateLiteral([v.string()])
}
function _nested() {
	return v.templateLiteral([v.templateLiteral([v.number(), 'px']), '!'])
}
function _autoOrNumber() {
	return v.templateLiteral([v.union(['auto', v.number()]), 'px'])
}
function _stringXNumber() {
	return v.templateLiteral([v.string(), 'x', v.number()])
}
function _stringNumber() {
	return v.templateLiteral([v.string(), v.number()])
}
function _numberString() {
	return v.templateLiteral([v.number(), v.string()])
}
function _twoOpenStrings() {
	return v.templateLiteral([v.string(), v.string()])
}

describe('templateLiteral type-state contracts', () => {
	it('assembles the exact template-literal output type', () => {
		expectTypeOf<InferOutput<ReturnType<typeof _idNumber>>>()
			.toEqualTypeOf<`ID-${number}`>()
		expectTypeOf<InferOutput<ReturnType<typeof _numberUnit>>>()
			.toEqualTypeOf<`${number}px` | `${number}em` | `${number}rem`>()
		expectTypeOf<InferOutput<ReturnType<typeof _crossProduct>>>()
			.toEqualTypeOf<'a-1' | 'a-2' | 'b-1' | 'b-2'>()
		expectTypeOf<InferOutput<ReturnType<typeof _twoStrings>>>()
			.toEqualTypeOf<`${string}@${string}`>()
		expectTypeOf<InferOutput<ReturnType<typeof _versioned>>>()
			.toEqualTypeOf<`v${bigint}`>()
		expectTypeOf<InferOutput<ReturnType<typeof _isBoolean>>>()
			.toEqualTypeOf<'is:true' | 'is:false'>()
		expectTypeOf<InferOutput<ReturnType<typeof _nullUndefined>>>()
			.toEqualTypeOf<'null/undefined'>()
		expectTypeOf<InferOutput<ReturnType<typeof _allLiterals>>>()
			.toEqualTypeOf<'#1true2nullundefined'>()
		expectTypeOf<InferOutput<ReturnType<typeof _empty>>>()
			.toEqualTypeOf<''>()
		expectTypeOf<InferOutput<ReturnType<typeof _singleString>>>()
			.toEqualTypeOf<string>()
		expectTypeOf<InferOutput<ReturnType<typeof _nested>>>()
			.toEqualTypeOf<`${number}px!`>()
		expectTypeOf<InferOutput<ReturnType<typeof _autoOrNumber>>>()
			.toEqualTypeOf<'autopx' | `${number}px`>()
	})

	it('is synchronous and carries only its owned issue plus core issues', () => {
		const _schema = v.templateLiteral(['ID-', v.number()])
		expectTypeOf<InferOperationMode<typeof _schema>>()
			.toEqualTypeOf<'sync'>()
		expectTypeOf<InferIssue<typeof _schema>['code']>()
			.toEqualTypeOf<
				'templateLiteral:expected_template_literal' | 'core:unknown_exception' | 'core:message_exception'
		>()
	})

	it('matches the runtime tsc split-rule at the type level', () => {
		type StringXNumber = InferOutput<ReturnType<typeof _stringXNumber>>
		expectTypeOf<IsMember<'ax1', StringXNumber>>()
			.toEqualTypeOf<true>()
		expectTypeOf<IsMember<'axbx1', StringXNumber>>()
			.toEqualTypeOf<false>()

		type StringNumber = InferOutput<ReturnType<typeof _stringNumber>>
		expectTypeOf<IsMember<'abc1', StringNumber>>()
			.toEqualTypeOf<false>()

		type NumberString = InferOutput<ReturnType<typeof _numberString>>
		expectTypeOf<IsMember<'1abc', NumberString>>()
			.toEqualTypeOf<true>()

		// All-string reduction: `${string}${string}` is exactly `string`.
		expectTypeOf<InferOutput<ReturnType<typeof _twoOpenStrings>>>()
			.toEqualTypeOf<string>()
	})

	it('is unavailable after the schema already has a concrete output', () => {
		if (false as boolean) {
			v.string()
				// @ts-expect-error templateLiteral is an initial schema; not available after string()
				.templateLiteral([v.string()])
		}
	})

	it('rejects non-interpolatable parts at compile time', () => {
		if (false as boolean) {
			// @ts-expect-error a symbol has no template-literal representation
			v.templateLiteral([Symbol('x')])
			// @ts-expect-error an object-output schema is not interpolatable
			v.templateLiteral([v.object({})])
			// @ts-expect-error a plain object is not an interpolatable literal
			v.templateLiteral([{}])
		}
	})
})
