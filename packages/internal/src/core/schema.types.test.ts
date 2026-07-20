import type { InferIssue, InferOperationMode, InferOutput } from './types'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { fallback, looseObject, object, strictObject, string, toAsync, transform, unknown, use } from '../steps'
import { createValchecker } from './core'

const v = createValchecker({
	steps: [fallback, looseObject, object, strictObject, string, toAsync, transform, unknown, use],
})

describe('schema type-state contracts', () => {
	it('models asynchronous transforms as maybe-async until toAsync is applied', async () => {
		const schema = v.string().transform(async value => value.toUpperCase())

		expectTypeOf<InferOperationMode<typeof schema>>().toEqualTypeOf<'maybe-async'>()
		expect(schema['~core'].operationMode).toBe('maybe-async')
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<string>()

		const syncFailure = schema.execute(42 as any)
		expect(syncFailure).not.toBeInstanceOf(Promise)
		expect(syncFailure).toMatchObject({ issues: [{ code: 'string:expected_string' }] })

		const success = schema.execute('hello')
		expect(success).toBeInstanceOf(Promise)
		await expect(success).resolves.toEqual({ value: 'HELLO' })

		const alwaysAsync = schema.toAsync()
		expectTypeOf<InferOperationMode<typeof alwaysAsync>>().toEqualTypeOf<'async'>()
		expect(alwaysAsync['~core'].operationMode).toBe('async')
		const promised: Promise<unknown> = alwaysAsync.execute(42 as any)
		expect(promised).toBeInstanceOf(Promise)
		await expect(promised).resolves.toMatchObject({ issues: [{ code: 'string:expected_string' }] })
	})

	it('propagates child operation modes and precise structural outputs', async () => {
		const child = v.string().transform(async value => value.toUpperCase())
		const objectSchema = v.object({ value: child })
		const strictSchema = v.strictObject({ value: child })
		const looseSchema = v.looseObject({ value: child })

		expectTypeOf<InferOperationMode<typeof objectSchema>>().toEqualTypeOf<'maybe-async'>()
		expect(objectSchema['~core'].operationMode).toBe('maybe-async')
		expectTypeOf<InferOutput<typeof objectSchema>>().toEqualTypeOf<{ value: string }>()
		expectTypeOf<InferOperationMode<typeof strictSchema>>().toEqualTypeOf<'maybe-async'>()
		expect(strictSchema['~core'].operationMode).toBe('maybe-async')
		expectTypeOf<InferOutput<typeof strictSchema>>().toEqualTypeOf<{ value: string }>()
		expectTypeOf<InferOperationMode<typeof looseSchema>>().toEqualTypeOf<'maybe-async'>()
		expect(looseSchema['~core'].operationMode).toBe('maybe-async')
		expectTypeOf<InferOutput<typeof looseSchema>>().toMatchTypeOf<{ value: string }>()

		expect(objectSchema.execute(null as any)).not.toBeInstanceOf(Promise)
		await expect(objectSchema.execute({ value: 'hello' })).resolves.toEqual({
			value: { value: 'HELLO' },
		})
		await expect(strictSchema.execute({ value: 'hello' })).resolves.toEqual({
			value: { value: 'HELLO' },
		})
		await expect(looseSchema.execute({ value: 'hello', extra: true })).resolves.toEqual({
			value: { value: 'HELLO', extra: true },
		})
	})

	it('materializes optional object properties in output types', () => {
		const objectSchema = v.object({ value: [v.string()] })
		const strictSchema = v.strictObject({ value: [v.string()] })
		const looseSchema = v.looseObject({ value: [v.string()] })

		expectTypeOf<InferOutput<typeof objectSchema>>()
			.toEqualTypeOf<{ value: string | undefined }>()
		expectTypeOf<InferOutput<typeof strictSchema>>()
			.toEqualTypeOf<{ value: string | undefined }>()
		expectTypeOf<InferOutput<typeof looseSchema>>()
			.toMatchTypeOf<{ value: string | undefined }>()
	})

	it('preserves delegated output, issue, and operation-mode contracts', async () => {
		const delegated = v.string().transform(async value => value.toUpperCase())
		const schema = v.unknown().use(delegated)

		expectTypeOf<InferOperationMode<typeof schema>>().toEqualTypeOf<'maybe-async'>()
		expect(schema['~core'].operationMode).toBe('maybe-async')
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<string>()
		expectTypeOf<InferIssue<typeof schema>>().toEqualTypeOf<InferIssue<typeof delegated>>()

		const result = schema.execute('hello')
		expect(result).toBeInstanceOf(Promise)
		await expect(result).resolves.toEqual({ value: 'HELLO' })
	})

	it('assimilates non-native thenables with matching type and runtime contracts', async () => {
		const thenable = {
			then(resolve: (value: string) => unknown) {
				resolve('HELLO')
			},
		} as unknown as PromiseLike<string>
		const schema = v.string().transform(() => thenable)

		expectTypeOf<InferOperationMode<typeof schema>>().toEqualTypeOf<'maybe-async'>()
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<string>()
		const result = schema.execute('hello')
		expect(result).toBeInstanceOf(Promise)
		await expect(result).resolves.toEqual({ value: 'HELLO' })
	})

	it('accepts PromiseLike fallback results without promising unconditional async execution', async () => {
		const thenable = {
			then(resolve: (value: string) => unknown) {
				resolve('fallback')
			},
		} as unknown as PromiseLike<string>
		const schema = v.string().fallback(() => thenable)

		expectTypeOf<InferOperationMode<typeof schema>>().toEqualTypeOf<'maybe-async'>()
		const result = schema.execute(42)
		expect(result).toBeInstanceOf(Promise)
		await expect(result).resolves.toEqual({ value: 'fallback' })
	})
})
