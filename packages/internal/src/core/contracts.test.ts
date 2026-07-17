import type { ExecutionIssue, InferIssue, InferOperationMode, InferOutput } from './types'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { runtimeExecutionStepDefMarker } from '../shared'
import { fallback, looseObject, object, strictObject, string, toAsync, transform, unknown, use } from '../steps'
import { createValchecker, handleMessage, prependIssuePath, resolveMessagePriority } from './core'

const v = createValchecker({ steps: [fallback, looseObject, object, strictObject, string, toAsync, transform, unknown, use] })

describe('public contracts', () => {
	it('should model async transforms as maybe-async until toAsync is applied', async () => {
		const schema = v.string()
			.transform(async value => value.toUpperCase())
		expectTypeOf<InferOperationMode<typeof schema>>()
			.toEqualTypeOf<'maybe-async'>()
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<string>()

		const syncFailure = schema.execute(42 as any)
		expect(syncFailure).not.toBeInstanceOf(Promise)
		expect(syncFailure)
			.toMatchObject({ issues: [{ code: 'string:expected_string' }] })

		const success = schema.execute('hello')
		expect(success)
			.toBeInstanceOf(Promise)
		expect(await success)
			.toEqual({ value: 'HELLO' })

		const alwaysAsync = schema.toAsync()
		expectTypeOf<InferOperationMode<typeof alwaysAsync>>()
			.toEqualTypeOf<'async'>()
		const promised: Promise<unknown> = alwaysAsync.execute(42 as any)
		expect(promised)
			.toBeInstanceOf(Promise)
		expect(await promised)
			.toMatchObject({ issues: [{ code: 'string:expected_string' }] })
	})

	it('should propagate maybe-async child modes and precise object outputs', async () => {
		const child = v.string()
			.transform(async value => value.toUpperCase())
		const strictSchema = v.strictObject({ value: child })
		const looseSchema = v.looseObject({ value: child })

		expectTypeOf<InferOperationMode<typeof strictSchema>>()
			.toEqualTypeOf<'maybe-async'>()
		expectTypeOf<InferOutput<typeof strictSchema>>()
			.toEqualTypeOf<{ value: string }>()
		expectTypeOf<InferOperationMode<typeof looseSchema>>()
			.toEqualTypeOf<'maybe-async'>()
		expectTypeOf<InferOutput<typeof looseSchema>>()
			.toMatchTypeOf<{ value: string }>()

		const strictFailure = strictSchema.execute(null as any)
		expect(strictFailure).not.toBeInstanceOf(Promise)
		const strictSuccess = strictSchema.execute({ value: 'hello' })
		expect(strictSuccess)
			.toBeInstanceOf(Promise)
		expect(await strictSuccess)
			.toEqual({ value: { value: 'HELLO' } })

		const looseSuccess = looseSchema.execute({ value: 'hello', extra: true })
		expect(looseSuccess)
			.toBeInstanceOf(Promise)
		expect(await looseSuccess)
			.toEqual({ value: { value: 'HELLO', extra: true } })
	})

	it('should preserve delegated output and issue types without promising unconditional async execution', async () => {
		const delegated = v.string()
			.transform(async value => value.toUpperCase())
		const schema = v.unknown()
			.use(delegated)

		expectTypeOf<InferOperationMode<typeof schema>>()
			.toEqualTypeOf<'maybe-async'>()
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<string>()
		expectTypeOf<InferIssue<typeof schema>>()
			.toEqualTypeOf<InferIssue<typeof delegated>>()

		const result = schema.execute('hello')
		expect(result)
			.toBeInstanceOf(Promise)
		expect(await result)
			.toEqual({ value: 'HELLO' })
	})

	it('should assimilate non-native thenables using the same type and runtime contract', async () => {
		const thenable = {
			then(resolve: (value: string) => unknown) {
				resolve('HELLO')
			},
		} as unknown as PromiseLike<string>
		const schema = v.string()
			.transform(() => thenable)

		expectTypeOf<InferOperationMode<typeof schema>>()
			.toEqualTypeOf<'maybe-async'>()
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<string>()
		const result = schema.execute('hello')
		expect(result)
			.toBeInstanceOf(Promise)
		expect(await result)
			.toEqual({ value: 'HELLO' })
	})

	it('should use one global-before-default message priority implementation', () => {
		const params = {
			data: { code: 'string:expected_string', payload: { value: 42 }, path: [] },
			customMessage: undefined,
			defaultMessage: 'default',
			globalMessage: 'global',
		}
		expect(resolveMessagePriority(params))
			.toBe('global')

		const localized = createValchecker({
			steps: [string],
			message: ({ code }) => `global:${code}`,
		})
		expect(localized.string()
			.execute(42))
			.toMatchObject({
				issues: [{ message: 'global:string:expected_string' }],
			})
	})

	it('should reject duplicate and reserved step method names', () => {
		expect(() => (createValchecker as any)({ steps: [string, string] }))
			.toThrowError('Duplicate step method: string')
		expect(() => (createValchecker as any)({ steps: [{ execute() {} }] }))
			.toThrowError('Reserved step method: execute')
		expect(() => (createValchecker as any)({ steps: [{ then() {} }] }))
			.toThrowError('Reserved step method: then')
	})

	it('should accept PromiseLike fallback results and return a native Promise', async () => {
		const thenable = {
			then(resolve: (value: string) => unknown) {
				resolve('fallback')
			},
		} as unknown as PromiseLike<string>
		const schema = v.string()
			.fallback(() => thenable)

		expectTypeOf<InferOperationMode<typeof schema>>()
			.toEqualTypeOf<'maybe-async'>()
		const result = schema.execute(42)
		expect(result)
			.toBeInstanceOf(Promise)
		expect(await result)
			.toEqual({ value: 'fallback' })
	})

	it('should ignore inherited message-map keys', () => {
		const data = { code: 'toString', payload: {}, path: [] }
		expect(handleMessage(data, {} as any))
			.toBeNull()
		expect(handleMessage(data, { toString: () => 'own' } as any))
			.toBe('own')
	})

	it('should prepend issue paths without mutating the original issue', () => {
		const issue = Object.freeze({
			code: 'test:error',
			category: 'validation',
			message: 'error',
			path: Object.freeze(['leaf']),
			payload: {},
		}) as unknown as ExecutionIssue
		const prefixed = prependIssuePath(issue, ['root'])

		expect(prefixed).not.toBe(issue)
		expect(prefixed.path)
			.toEqual(['root', 'leaf'])
		expect(issue.path)
			.toEqual(['leaf'])
	})

	it('should preserve own __proto__ fields without changing output prototypes', async () => {
		const struct = Object.create(null) as Record<string, any>
		Object.defineProperty(struct, '__proto__', {
			configurable: true,
			enumerable: true,
			value: v.unknown()
				.transform(async value => value),
			writable: true,
		})

		const protoValue = { safe: true }
		const input = Object.create(null) as Record<string, unknown>
		Object.defineProperty(input, '__proto__', {
			configurable: true,
			enumerable: true,
			value: protoValue,
			writable: true,
		})

		const schemas = [
			v.object(struct),
			v.strictObject(struct),
			v.looseObject(struct),
		]
		for (const schema of schemas) {
			const result = await schema.execute(input as any)
			expect(v.isSuccess(result))
				.toBe(true)
			if (v.isSuccess(result)) {
				const output = result.value as Record<string, unknown>
				expect(Object.getPrototypeOf(output))
					.toBe(Object.prototype)
				expect(Object.hasOwn(output, '__proto__'))
					.toBe(true)
				expect(Reflect.get(output, '__proto__'))
					.toBe(protoValue)
			}
		}
	})

	it('should reject enumerable symbol keys in strict objects', () => {
		const extra = Symbol('extra')
		const result = v.strictObject({})
			.execute({ [extra]: true })

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'strictObject:unexpected_keys',
					category: 'validation',
					payload: { keys: [extra] },
				}],
			})
	})

	it('should classify empty object structs as synchronous', () => {
		const objectSchema = v.object({})
		const strictSchema = v.strictObject({})
		const looseSchema = v.looseObject({})

		expectTypeOf<InferOperationMode<typeof objectSchema>>()
			.toEqualTypeOf<'sync'>()
		expectTypeOf<InferOperationMode<typeof strictSchema>>()
			.toEqualTypeOf<'sync'>()
		expectTypeOf<InferOperationMode<typeof looseSchema>>()
			.toEqualTypeOf<'sync'>()
		expect(objectSchema.execute({}))
			.toEqual({ value: {} })
		expect(strictSchema.execute({}))
			.toEqual({ value: {} })
		expect(looseSchema.execute({}))
			.toEqual({ value: {} })
	})

	it('should not validate inherited values as object fields', () => {
		const input = Object.create({ name: 'inherited' })
		const schemas = [
			v.object({ name: v.string() }),
			v.strictObject({ name: v.string() }),
			v.looseObject({ name: v.string() }),
		]

		for (const schema of schemas) {
			const result = schema.execute(input)
			expect(result)
				.toMatchObject({
					issues: [{
						code: 'string:expected_string',
						category: 'validation',
						path: ['name'],
						payload: { value: undefined },
					}],
				})
		}
	})

	it('should materialize transformed loose-object fields as data properties', () => {
		const input = Object.defineProperty({ extra: true }, 'name', {
			configurable: false,
			enumerable: true,
			get: () => 'Ada',
		})
		const result = v.looseObject({
			name: v.string()
				.transform(value => value.toUpperCase()),
		})
			.execute(input)

		expect(result)
			.toEqual({ value: { name: 'ADA', extra: true } })
		if (v.isSuccess(result)) {
			expect(Object.getOwnPropertyDescriptor(result.value, 'name'))
				.toMatchObject({
					enumerable: true,
					value: 'ADA',
					writable: true,
				})
		}
	})

	it('should register only valid step methods without leaking the plugin marker', () => {
		expect((v as any)[runtimeExecutionStepDefMarker])
			.toBeUndefined()

		const plugin = Object.defineProperty({}, 'custom', {
			configurable: true,
			enumerable: false,
			value: ({ utils: { addSuccessStep, success } }: any) => {
				addSuccessStep((value: unknown) => success(value))
			},
		})
		const custom = (createValchecker as any)({ steps: [plugin] })
		expect(custom.custom()
			.execute('value'))
			.toEqual({ value: 'value' })

		expect(() => (createValchecker as any)({ steps: [{ invalid: true }] }))
			.toThrowError('Invalid step method: invalid')
		const symbolMethod = Symbol('custom')
		expect(() => (createValchecker as any)({
			steps: [{ [symbolMethod]() {} }],
		}))
			.toThrowError('Invalid step method name: Symbol(custom)')
	})
})
