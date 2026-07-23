import type { InferOperationMode, InferOutput } from '../../core'
import { describe, expectTypeOf, it } from 'vitest'
import { check, createValchecker, unknown } from '../..'

const v = createValchecker({ steps: [check, unknown] })

describe('check type-state contracts', () => {
	it('narrows output through a type-guard predicate', () => {
		const _schema = v.unknown()
			.check((value): value is string => typeof value === 'string')

		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<string>()
		expectTypeOf<InferOperationMode<typeof _schema>>()
			.toEqualTypeOf<'sync'>()
	})

	it('narrows output through the callback utility', () => {
		const _schema = v.unknown()
			.check((value, { narrow }) => (
				typeof value === 'string' ? narrow<string>() : false
			))

		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<string>()
		expectTypeOf<InferOperationMode<typeof _schema>>()
			.toEqualTypeOf<'sync'>()
	})

	it('marks promise-returning predicates as maybe-async', () => {
		const _schema = v.unknown()
			.check(async () => true)

		expectTypeOf<InferOperationMode<typeof _schema>>()
			.toEqualTypeOf<'maybe-async'>()
	})
})
