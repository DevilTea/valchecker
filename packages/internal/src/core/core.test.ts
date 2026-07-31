import type { ExecutionIssue, ExecutionResult, StepPluginImpl, TStepPluginDef } from './types'
import { describe, expect, it, vi } from 'vitest'
import { runtimeExecutionStepDefMarker } from '../shared'
import {
	appendIssueContext,
	createValchecker,
	handleMessage,
	hasInternalIssue,
	implStepPlugin,
	isFailure,
	isSuccess,
	prependIssuePath,
	replaceIssuePath,
	resolveMessagePriority,
} from './core'

function validationIssue(
	code = 'test:error',
	path: PropertyKey[] = [],
): ExecutionIssue {
	return {
		code,
		category: 'validation',
		payload: {},
		message: 'Test error',
		path,
	}
}

const metaKeyA = Symbol.for('valchecker-test:metaA')
const metaKeyB = Symbol.for('valchecker-test:metaB')

const flowPlugin = implStepPlugin({
	increment: ({ utils, params: [amount = 1] }: any) => {
		utils.addSuccessStep((value: number) => utils.success(value + amount), 'sync')
	},
	fail: ({ utils, params: [message] }: any) => {
		utils.addSuccessStep((value: unknown) => utils.failure(utils.createIssue({
			code: 'test:failed',
			payload: { value },
			customMessage: message,
			defaultMessage: 'Test failure.',
		})), 'sync')
	},
	issueWithoutContext: ({ utils }: any) => {
		utils.addSuccessStep((value: unknown) => utils.failure(utils.createIssue({
			code: 'test:no_context',
			payload: { value },
			defaultMessage: 'No context.',
		})), 'sync')
	},
	issueWithContext: ({ utils }: any) => {
		utils.addSuccessStep((value: unknown) => utils.failure(utils.createIssue({
			code: 'test:with_context',
			payload: { value },
			context: [{ type: 'fixture' }],
			defaultMessage: 'With context.',
		})), 'sync')
	},
	recover: ({ utils }: any) => {
		utils.addFailureStep((issues: ExecutionIssue[]) => utils.success(`recovered:${issues[0]!.code}`), 'sync')
	},
	throwSync: ({ utils }: any) => {
		utils.addStep(() => {
			throw new Error('sync error')
		}, 'sync')
	},
	rejectAsync: ({ utils }: any) => {
		utils.addStep(async () => {
			throw new Error('async error')
		}, 'async')
	},
	inspectResult: ({ utils }: any) => {
		utils.addStep((result: ExecutionResult) => {
			// `utils` is untyped here, so use the imported type-guard helpers to
			// narrow the result union.
			if (isSuccess(result))
				return utils.success(result.value)
			if (isFailure(result))
				return utils.failure(result.issues)
			throw new Error('unreachable')
		}, 'sync')
	},
	composeInitialIncrement: ({ utils, params: [amount], context }: any) => {
		const schema = context.createInitialSchema('increment', [amount])
		utils.addSuccessStep((value: unknown) => schema['~execute'](value), 'sync')
	},
	contextFailure: ({ utils }: any) => {
		utils.addSuccessStep(() => {
			const issue = utils.issue(validationIssue('test:context'))
			return utils.failure(utils.appendIssueContext(
				utils.prependIssuePath(issue, ['root']),
				{ type: 'test', marker: true },
			))
		}, 'sync')
	},
	unannotated: ({ utils }: any) => {
		utils.addStep((result: ExecutionResult) => result)
	},
	maybeAsync: ({ utils }: any) => {
		utils.addStep((result: ExecutionResult) => result, 'maybe-async')
	},
	asyncMode: ({ utils }: any) => {
		utils.addStep(async (result: ExecutionResult) => result, 'async')
	},
	attachMeta: ({ utils }: any) => {
		utils.addSuccessStep((value: unknown) => utils.success(value), 'sync')
		utils.setMetadata(metaKeyA, ['a', 'b'])
		utils.setMetadata(metaKeyB, { tag: 'meta' })
	},
} as any) as StepPluginImpl<TStepPluginDef>

describe('core result contracts', () => {
	it.each([
		[{ value: 'value' }, true, false],
		[{ value: undefined }, true, false],
		[{ value: null }, true, false],
		[{ issues: [validationIssue()] }, false, true],
		// Runtime guards intentionally classify by the discriminant property,
		// even when a JavaScript caller constructs an invalid empty issue array.
		[{ issues: [] }, false, true],
	] as const)('classifies execution result %j', (result, success, failure) => {
		expect(isSuccess(result as ExecutionResult))
			.toBe(success)
		expect(isFailure(result as ExecutionResult))
			.toBe(failure)
	})

	it('detects an internal issue anywhere in a failure tuple', () => {
		const validation = validationIssue()
		const internal: ExecutionIssue<string, unknown, 'internal'> = {
			...validationIssue('test:internal'),
			category: 'internal',
		}

		expect(hasInternalIssue([validation]))
			.toBe(false)
		expect(hasInternalIssue([validation, internal]))
			.toBe(true)
		expect(hasInternalIssue([internal, validation]))
			.toBe(true)
	})
})

describe('core issue contracts', () => {
	it('marks a plugin without replacing its object identity', () => {
		const plugin = {} as StepPluginImpl<TStepPluginDef>
		const result = implStepPlugin(plugin)

		expect(result)
			.toBe(plugin)
		expect((result as any)[runtimeExecutionStepDefMarker])
			.toBe(true)
		expect(implStepPlugin(result))
			.toBe(result)
	})

	it('prepends mixed property keys without mutating the source issue', () => {
		const symbol = Symbol('leaf')
		const issue = Object.freeze({
			...validationIssue('test:path', [symbol, 0]),
			path: Object.freeze([symbol, 0]),
		}) as unknown as ExecutionIssue
		const result = prependIssuePath(issue, ['root', 1])

		expect(result).not.toBe(issue)
		expect(result.path)
			.toEqual(['root', 1, symbol, 0])
		expect(issue.path)
			.toEqual([symbol, 0])
	})

	it('returns the original issue when no path or message scope is added', () => {
		const issue = validationIssue('test:path', ['leaf'])
		expect(prependIssuePath(issue, []))
			.toBe(issue)
	})

	it('appends context immutably and preserves existing context order', () => {
		const issue = {
			...validationIssue('test:context'),
			context: [{ type: 'existing' }],
		}
		const result = appendIssueContext(issue, { type: 'union', branchIndex: 1 })

		expect(result).not.toBe(issue)
		expect(result.context)
			.toEqual([
				{ type: 'existing' },
				{ type: 'union', branchIndex: 1 },
			])
		expect(issue.context)
			.toEqual([{ type: 'existing' }])
	})

	// `context` is documented as optional, which means absent rather than present-and-
	// undefined. Every other assertion here uses `toEqual` or `toMatchObject`, and both treat
	// an `undefined` property as equal to a missing one, so a `createIssue` that always
	// assigned the key would have looked correct everywhere.
	it('omits the context key entirely when a step declares none', () => {
		const v = createValchecker({ steps: [flowPlugin] }) as any
		const withoutContext = v.issueWithoutContext()
			.execute('value')
		const withContext = v.issueWithContext()
			.execute('value')

		expect(Object.hasOwn(withoutContext.issues[0], 'context'))
			.toBe(false)
		expect(Object.hasOwn(withContext.issues[0], 'context'))
			.toBe(true)
		expect(withContext.issues[0].context)
			.toEqual([{ type: 'fixture' }])
	})

	it('replaces the issue path unconditionally without mutating the source', () => {
		const issue = validationIssue('test:path', ['old', 0])
		const result = replaceIssuePath(issue, ['new'])

		expect(result).not.toBe(issue)
		expect(result.path)
			.toEqual(['new'])
		expect(issue.path)
			.toEqual(['old', 0])
	})

	it('replaces an existing path with an empty path', () => {
		const issue = validationIssue('test:path', ['old'])
		expect(replaceIssuePath(issue, []).path)
			.toEqual([])
	})
})

describe('message contracts', () => {
	const data = {
		code: 'test:error',
		payload: { value: 42 },
		path: ['root'],
	}

	it.each([
		[null, null],
		[undefined, undefined],
		['Static message', 'Static message'],
	] as const)('returns scalar message handler %j', (handler, expected) => {
		expect(handleMessage(data, handler))
			.toBe(expected)
	})

	it('normalizes callback data and defaults the issue category', () => {
		const handler = vi.fn((issue: any) => `${issue.category}:${issue.path.join('.')}:${issue.payload.value}`)

		expect(handleMessage(data, handler))
			.toBe('validation:root:42')
		expect(handler)
			.toHaveBeenCalledOnce()
	})

	it('uses only an own function entry from a message map', () => {
		const inherited = { 'test:error': () => 'inherited' }
		const map = Object.create(inherited)

		expect(handleMessage(data, map))
			.toBeNull()
		expect(handleMessage(data, { 'test:error': 'not a function' } as any))
			.toBeNull()
		expect(handleMessage(data, { 'test:error': () => 'own' }))
			.toBe('own')
	})

	it('resolves step, nearest context, global, default, and fallback messages in order', () => {
		const resolve = (overrides: Partial<Parameters<typeof resolveMessagePriority>[0]>) => resolveMessagePriority({
			data,
			customMessage: null,
			contextMessages: [],
			globalMessage: undefined,
			defaultMessage: null,
			...overrides,
		})

		expect(resolve({
			customMessage: 'step',
			contextMessages: ['context'],
			globalMessage: 'global',
			defaultMessage: 'default',
		}))
			.toBe('step')
		expect(resolve({
			contextMessages: [() => null, 'nearest', 'outer'],
			globalMessage: 'global',
			defaultMessage: 'default',
		}))
			.toBe('nearest')
		expect(resolve({ globalMessage: 'global', defaultMessage: 'default' }))
			.toBe('global')
		expect(resolve({ defaultMessage: 'default' }))
			.toBe('default')
		expect(resolve({}))
			.toBe('Invalid value.')
	})

	it('continues message priority when callbacks and maps return no message', () => {
		expect(resolveMessagePriority({
			data,
			customMessage: { 'test:error': () => undefined },
			contextMessages: [{ 'test:error': () => null }],
			globalMessage: { 'test:error': () => 'global' },
			defaultMessage: 'default',
		}))
			.toBe('global')
	})
})

describe('valchecker instance contracts', () => {
	it('exposes one executable empty-schema contract', () => {
		// An empty step list yields a degenerate instance whose type collapses to
		// `never`; this test only asserts the runtime base-instance contract.
		const v = createValchecker({ steps: [] }) as any

		expect(v.execute('value'))
			.toEqual({ value: 'value' })
		expect(v['~execute']('value'))
			.toEqual({ value: 'value' })
		expect(v['~core'].runtimeSteps)
			.toEqual([])
		expect(v['~core'].operationMode)
			.toBe('sync')
		expect(v['~standard'])
			.toEqual({
				version: 1,
				vendor: 'valchecker',
				validate: v.execute,
			})
	})

	// The shared-prototype layout is an architectural contract, not an accident: registered
	// methods are non-enumerable prototype properties and the fixed schema fields are own
	// enumerable ones, which is what makes `Object.keys` and `for...in` over a schema return
	// its data rather than the whole registered API. Nothing asserted the descriptors, so a
	// change to any of the three flags was invisible. They are pinned together because the
	// three arguments are one decision about how a schema presents itself.
	it('registers step methods as non-enumerable, writable, configurable prototype properties', () => {
		const v = createValchecker({ steps: [flowPlugin] }) as any
		const schema = v.increment(1)
		const prototype = Object.getPrototypeOf(schema)

		expect(Object.hasOwn(schema, 'increment'))
			.toBe(false)
		expect(Object.getOwnPropertyDescriptor(prototype, 'increment'))
			.toMatchObject({ enumerable: false, writable: true, configurable: true })

		// The observable consequence, stated separately from the descriptor that causes it.
		const fixedFields = ['~standard', '~core', '~execute', 'execute', 'isSuccess', 'isFailure']
		expect(Object.keys(schema))
			.toEqual(fixedFields)
		const enumerated: string[] = []
		for (const key in schema)
			enumerated.push(key)
		expect(enumerated)
			.toEqual(fixedFields)
	})

	it('creates immutable chains and passes method parameters', () => {
		const v = createValchecker({ steps: [flowPlugin] }) as any
		const incremented = v.increment(2)
		const chained = incremented.increment(3)
			.inspectResult()

		expect(v.execute(1))
			.toEqual({ value: 1 })
		expect(incremented.execute(1))
			.toEqual({ value: 3 })
		expect(chained.execute(1))
			.toEqual({ value: 6 })
		expect(v['~core'].runtimeSteps)
			.toHaveLength(0)
		expect(incremented['~core'].runtimeSteps)
			.toHaveLength(1)
		expect(chained['~core'].runtimeSteps)
			.toHaveLength(3)
		expect(v['~core'].operationMode)
			.toBe('sync')
		expect(incremented['~core'].operationMode)
			.toBe('sync')
		expect(chained['~core'].operationMode)
			.toBe('sync')
		expect(v.unannotated()['~core'].operationMode)
			.toBe('maybe-async')
		expect(v.unannotated()
			.execute(1))
			.toEqual({ value: 1 })
		expect(v.maybeAsync()['~core'].operationMode)
			.toBe('maybe-async')
		expect(v.maybeAsync()
			.increment()['~core'].operationMode)
			.toBe('maybe-async')
		expect(v.asyncMode()['~core'].operationMode)
			.toBe('async')
		expect(v.asyncMode()
			.maybeAsync()['~core'].operationMode)
			.toBe('async')
	})

	it('exposes every registered plugin capability to a step, in registration order', () => {
		const shorthand = Symbol('shorthand')
		const annotation = Symbol('annotation')
		const seen: unknown[] = []

		// One plugin may declare several capabilities, and several plugins may
		// declare the same one; a consumer sees each entry once, in registration
		// order.
		const provider = implStepPlugin(
			{ provide: ({ utils }: any) => utils.addSuccessStep(utils.success) } as any,
			'sync',
			{ [shorthand]: 'first', [annotation]: 'annotated' },
		) as StepPluginImpl<TStepPluginDef>
		const secondProvider = implStepPlugin(
			{ provideMore: ({ utils }: any) => utils.addSuccessStep(utils.success) } as any,
			'sync',
			{ [shorthand]: 'second' },
		) as StepPluginImpl<TStepPluginDef>

		const consumer = implStepPlugin({
			consume: ({ utils, context }: any) => {
				seen.push(context.getCapabilities(shorthand), context.getCapabilities(annotation), context.getCapabilities(Symbol('absent')))
				utils.addSuccessStep(utils.success)
			},
		} as any, 'sync') as StepPluginImpl<TStepPluginDef>

		const w = createValchecker({ steps: [provider, secondProvider, consumer] }) as any
		w.consume()

		expect(seen)
			.toEqual([['first', 'second'], ['annotated'], []])
	})

	it('exposes construction-time metadata on ~core and drops it on chaining', () => {
		const v = createValchecker({ steps: [flowPlugin] }) as any

		// No step wrote metadata: the field is present but undefined.
		expect(v['~core'].metadata)
			.toBeUndefined()

		// Two different symbol keys set in the same construction call coexist.
		const withMeta = v.attachMeta()
		expect(withMeta['~core'].metadata[metaKeyA])
			.toEqual(['a', 'b'])
		expect(withMeta['~core'].metadata[metaKeyB])
			.toEqual({ tag: 'meta' })

		// A later step that does not redeclare drops the metadata (fresh utils
		// per call; not carried forward on chaining).
		expect(withMeta.increment()['~core'].metadata)
			.toBeUndefined()
	})

	it('composes an initial schema from the same registry without inheriting the current chain', () => {
		const v = createValchecker({ steps: [flowPlugin] }) as any
		const schema = v.increment(10)
			.composeInitialIncrement(2)

		expect(schema.execute(1))
			.toEqual({ value: 13 })
	})

	it('runs success and failure steps only for their matching result variant', () => {
		const v = createValchecker({ steps: [flowPlugin] }) as any

		expect(v.increment()
			.recover()
			.execute(1))
			.toEqual({ value: 2 })
		expect(v.fail()
			.increment()
			.execute('value'))
			.toMatchObject({
				issues: [{ code: 'test:failed' }],
			})
		expect(v.fail()
			.recover()
			.execute('value'))
			.toEqual({ value: 'recovered:test:failed' })
	})

	it('finalizes paths, context, and a configured global message on actual failures', () => {
		const v = createValchecker({
			steps: [flowPlugin],
			message: ({ code, path }) => `global:${code}:${path.join('.')}`,
		}) as any

		expect(v.fail()
			.execute('value'))
			.toMatchObject({
				issues: [{ message: 'global:test:failed:', path: [] }],
			})
		expect(v.contextFailure()
			.execute('value'))
			.toMatchObject({
				issues: [{
					code: 'test:context',
					path: ['root'],
					context: [{ type: 'test', marker: true }],
				}],
			})
	})

	it('normalizes synchronous step exceptions into internal issues', () => {
		const v = createValchecker({ steps: [flowPlugin] }) as any
		const result = v.throwSync()
			.execute('value')

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					message: 'An unexpected error occurred during step execution.',
					path: [],
					payload: {
						method: 'throwSync',
						receivedResult: { value: 'value' },
						error: expect.objectContaining({ message: 'sync error' }),
					},
				}],
			})
	})

	it('normalizes asynchronous step rejections into internal issues', async () => {
		const v = createValchecker({ steps: [flowPlugin] }) as any
		const result = v.rejectAsync()
			.execute('value')

		expect(result)
			.toBeInstanceOf(Promise)
		await expect(result).resolves.toMatchObject({
			issues: [{
				code: 'core:unknown_exception',
				category: 'internal',
				payload: {
					method: 'rejectAsync',
					receivedResult: { value: 'value' },
					error: expect.objectContaining({ message: 'async error' }),
				},
			}],
		})
	})

	it.each([
		['duplicate', [flowPlugin, flowPlugin], 'Duplicate step method: increment'],
		['reserved', [{ execute() {} }], 'Reserved step method: execute'],
		['thenable', [{ then() {} }], 'Reserved step method: then'],
		['non-function', [{ invalid: true }], 'Invalid step method: invalid'],
		['symbol name', [{ [Symbol('custom')]() {} }], 'Invalid step method name: Symbol(custom)'],
	] as const)('rejects %s plugin registrations', (_case, steps, message) => {
		expect(() => (createValchecker as any)({ steps }))
			.toThrowError(message)
	})
})
