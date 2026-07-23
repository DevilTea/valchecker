import type { InferIssue, InferOperationMode, InferOutput } from '../../core'
import { describe, expectTypeOf, it } from 'vitest'
import { createValchecker, literal, null_, number, string, transform, undefined_, union } from '../..'

const v = createValchecker({
	steps: [literal, null_, number, string, transform, undefined_, union],
})

describe('union type-state contracts', () => {
	it('infers the union of branch outputs and issues for synchronous branches', () => {
		const _schema = v.union([v.string(), v.number()])

		expectTypeOf<InferOperationMode<typeof _schema>>()
			.toEqualTypeOf<'sync'>()
		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<string | number>()
		expectTypeOf<InferIssue<typeof _schema>['code']>()
			.toEqualTypeOf<'string:expected_string' | 'number:expected_number' | 'core:unknown_exception' | 'core:message_exception'>()
	})

	it('becomes maybe-async when any branch can return a promise', () => {
		const _schema = v.union([
			v.string()
				.transform(async value => value.toUpperCase()),
			v.number(),
		])

		expectTypeOf<InferOperationMode<typeof _schema>>()
			.toEqualTypeOf<'maybe-async'>()
		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<string | number>()
	})

	it('infers registered shorthand outputs, issues, and sync mode', () => {
		const marker = Symbol('marker')
		const _schema = v.union([
			'draft',
			1,
			true,
			1n,
			marker,
			null,
			undefined,
			v.number(),
		])

		expectTypeOf<InferOperationMode<typeof _schema>>()
			.toEqualTypeOf<'sync'>()
		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<'draft' | 1 | true | 1n | typeof marker | null | undefined | number>()
		expectTypeOf<InferIssue<typeof _schema>['code']>()
			.toEqualTypeOf<
				| 'literal:expected_literal'
				| 'null:expected_null'
				| 'undefined:expected_undefined'
				| 'number:expected_number'
				| 'core:unknown_exception'
				| 'core:message_exception'
		>()
	})

	it('enables only shorthands backed by registered provider steps', () => {
		const schemaOnly = createValchecker({ steps: [string, union] })
		const literalOnly = createValchecker({ steps: [literal, union] })
		const nullOnly = createValchecker({ steps: [null_, union] })
		const undefinedOnly = createValchecker({ steps: [undefined_, union] })

		schemaOnly.union([schemaOnly.string()])
		literalOnly.union(['value'])
		nullOnly.union([null])
		undefinedOnly.union([undefined])

		if (false) {
			// @ts-expect-error literal shorthand requires the literal step
			schemaOnly.union(['value'])
			// @ts-expect-error null shorthand requires the null step
			schemaOnly.union([null])
			// @ts-expect-error undefined shorthand requires the undefined step
			schemaOnly.union([undefined])
			// @ts-expect-error null shorthand is independent from literal
			literalOnly.union([null])
			// @ts-expect-error undefined shorthand is independent from null
			nullOnly.union([undefined])
		}
	})
})
