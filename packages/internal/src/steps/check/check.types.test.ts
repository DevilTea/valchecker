import type { InferOperationMode, InferOutput } from '../../core'
import { describe, expectTypeOf, it } from 'vitest'
import { check, createValchecker, unknown } from '../..'

const v = createValchecker({ steps: [check, unknown] })

describe('check type-state contracts', () => {
	it('narrows output through a type-guard predicate', () => {
		const schema = v.unknown().check((value): value is string => typeof value === 'string')

		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<string>()
		expectTypeOf<InferOperationMode<typeof schema>>().toEqualTypeOf<'sync'>()
	})

	it('narrows output through the callback utility', () => {
		const schema = v.unknown().check((value, { narrow }) => (
			typeof value === 'string' ? narrow<string>() : false
		))

		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<string>()
		expectTypeOf<InferOperationMode<typeof schema>>().toEqualTypeOf<'sync'>()
	})

	it('marks promise-returning predicates as maybe-async', () => {
		const schema = v.unknown().check(async () => true)

		expectTypeOf<InferOperationMode<typeof schema>>().toEqualTypeOf<'maybe-async'>()
	})
})
