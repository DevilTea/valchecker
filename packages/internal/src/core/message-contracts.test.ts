import type {
	DefineExpectedValchecker,
	DefineStepMethod,
	DefineStepMethodMeta,
	ExecutionIssue,
	MessageHandler,
	Next,
	StepMethodUtils,
	TStepPluginDef,
} from './types'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { array, bigint, isAtLeast, number, object, string } from '../steps'
import { createValchecker, implStepPlugin } from './core'

type CustomIssue = ExecutionIssue<'custom:failed', { value: number }>

type CustomMeta = DefineStepMethodMeta<{
	Name: 'custom'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: CustomIssue
}>

interface CustomPluginDef extends TStepPluginDef {
	custom: DefineStepMethod<
		CustomMeta,
		this['CurrentValchecker'] extends CustomMeta['ExpectedCurrentValchecker']
			? (message?: MessageHandler<CustomIssue>) => Next<
					{ issue: CustomIssue },
					this['CurrentValchecker']
				>
			: never
	>
}

const custom = implStepPlugin<CustomPluginDef>({
	custom: ({
		utils: { addSuccessStep, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep(value => failure(createIssue({
			code: 'custom:failed',
			payload: { value: Number(value) },
			customMessage: message,
			defaultMessage: 'Custom failure.',
		})))
	},
})

function assertCreateIssueContracts(
	utils: StepMethodUtils<number, number, CustomIssue, CustomIssue>,
): void {
	utils.createIssue({
		code: 'custom:failed',
		payload: { value: 1 },
	})

	// @ts-expect-error createIssue rejects an issue code not declared by SelfIssue.
	utils.createIssue({ code: 'custom:other', payload: { value: 1 } })

	// @ts-expect-error createIssue rejects a payload that does not match the selected code.
	utils.createIssue({ code: 'custom:failed', payload: { value: '1' } })

	// @ts-expect-error validation issues cannot be mislabeled as internal failures.
	utils.createIssue({ code: 'custom:failed', category: 'internal', payload: { value: 1 } })
}
void assertCreateIssueContracts

describe('issue and message type contracts', () => {
	it('preserves selective global callback narrowing and same-code payload variants', () => {
		createValchecker({
			steps: [bigint, isAtLeast, number, string],
			message: (issue) => {
				if (issue.code === 'string:expected_string') {
					expectTypeOf(issue.category).toEqualTypeOf<'validation'>()
					expectTypeOf(issue.payload.value).toEqualTypeOf<unknown>()
				}
				else if (issue.code === 'isAtLeast:expected_at_least') {
					if (issue.payload.target === 'number') {
						expectTypeOf(issue.payload.value).toEqualTypeOf<number>()
						expectTypeOf(issue.payload.minimum).toEqualTypeOf<number>()
					}
					else {
						expectTypeOf(issue.payload.value).toEqualTypeOf<bigint>()
						expectTypeOf(issue.payload.minimum).toEqualTypeOf<bigint>()
					}
				}
				else if (issue.code === 'core:message_exception') {
					expectTypeOf(issue.category).toEqualTypeOf<'internal'>()
					expectTypeOf(issue.payload.source).toEqualTypeOf<'step' | 'context' | 'global' | 'default'>()
				}
				return null
			},
		})
	})

	it('preserves typed message-map payload unions and nullable returns', () => {
		createValchecker({
			steps: [bigint, isAtLeast, number],
			message: {
				'isAtLeast:expected_at_least': ({ payload }) => {
					if (payload.target === 'number')
						expectTypeOf(payload.value).toEqualTypeOf<number>()
					else
						expectTypeOf(payload.value).toEqualTypeOf<bigint>()
					return undefined
				},
				'core:unknown_exception': () => null,
			},
		})
	})

	it('does not expose unregistered issue codes in a selective message map', () => {
		createValchecker({
			steps: [string],
			message: {
				'string:expected_string': () => 'string',
				// @ts-expect-error number is not registered in this Valchecker instance.
				'number:expected_number': () => 'number',
			},
		})
	})

	it('keeps step-level, object-child, and custom-plugin handlers precise', () => {
		const v = createValchecker({ steps: [custom, isAtLeast, number, object] })

		v.number().isAtLeast(10, ({ payload }) => {
			expectTypeOf(payload.target).toEqualTypeOf<'number'>()
			expectTypeOf(payload.minimum).toEqualTypeOf<number>()
			return null
		})

		v.object({ value: v.number() }, {
			'number:expected_number': ({ payload, path }) => {
				expectTypeOf(payload.value).toEqualTypeOf<unknown>()
				expectTypeOf(path).toEqualTypeOf<PropertyKey[]>()
				return undefined
			},
		})

		createValchecker({
			steps: [custom],
			message: {
				'custom:failed': ({ payload }) => {
					expectTypeOf(payload.value).toEqualTypeOf<number>()
					return String(payload.value)
				},
			},
		})
	})
})

describe('issue finalization and message resolution', () => {
	it('resolves a leaf handler once with the final object path', () => {
		let calls = 0
		let receivedPath: PropertyKey[] | undefined
		const v = createValchecker({ steps: [number, object] })
		const schema = v.object({
			age: v.number(({ path }) => {
				calls++
				receivedPath = path
				return `Invalid ${String(path[0])}`
			}),
		})

		expect(schema.execute({ age: 'wrong' })).toEqual({
			issues: [{
				code: 'number:expected_number',
				category: 'validation',
				message: 'Invalid age',
				path: ['age'],
				payload: { value: 'wrong' },
			}],
		})
		expect(calls).toBe(1)
		expect(receivedPath).toEqual(['age'])
	})

	it('uses the nearest enclosing structure message before outer and global messages', () => {
		const v = createValchecker({
			steps: [number, object],
			message: () => 'global',
		})
		const schema = v.object({
			profile: v.object({
				age: v.number(),
			}, {
				'number:expected_number': ({ path }) => `inner:${path.join('.')}`,
			}),
		}, {
			'number:expected_number': () => 'outer',
		})

		expect(schema.execute({ profile: { age: 'wrong' } })).toMatchObject({
			issues: [{
				message: 'inner:profile.age',
				path: ['profile', 'age'],
			}],
		})
	})

	it('uses an enclosing structure message when the leaf has no custom message', () => {
		const v = createValchecker({ steps: [number, object] })
		const schema = v.object({ age: v.number() }, {
			'number:expected_number': ({ path }) => `object:${path.join('.')}`,
		})

		expect(schema.execute({ age: 'wrong' })).toMatchObject({
			issues: [{ message: 'object:age', path: ['age'] }],
		})
	})

	it('preserves the originating instance global resolver across composition', () => {
		const childV = createValchecker({
			steps: [number],
			message: ({ path }) => `child:${path.join('.')}`,
		})
		const outerV = createValchecker({
			steps: [object],
			message: () => 'outer-global',
		})
		const schema = outerV.object({ value: childV.number() })

		expect(schema.execute({ value: 'wrong' })).toMatchObject({
			issues: [{ message: 'child:value', path: ['value'] }],
		})
	})

	it('lets an explicit outer structure scope override a child instance global resolver', () => {
		const childV = createValchecker({
			steps: [number],
			message: () => 'child-global',
		})
		const outerV = createValchecker({ steps: [object] })
		const schema = outerV.object({ value: childV.number() }, {
			'number:expected_number': () => 'outer-scope',
		})

		expect(schema.execute({ value: 'wrong' })).toMatchObject({
			issues: [{ message: 'outer-scope' }],
		})
	})

	it('resolves array child messages with the final item path', () => {
		let receivedPath: PropertyKey[] | undefined
		const v = createValchecker({ steps: [array, number] })
		const schema = v.array(v.number(({ path }) => {
			receivedPath = path
			return `item:${String(path[0])}`
		}))

		expect(schema.execute(['wrong'])).toMatchObject({
			issues: [{ message: 'item:0', path: [0] }],
		})
		expect(receivedPath).toEqual([0])
	})

	it('continues message priority when a map callback returns null or undefined', () => {
		const v = createValchecker({
			steps: [number],
			message: () => 'global',
		})
		expect(v.number({
			'number:expected_number': () => undefined,
		}).execute('wrong')).toMatchObject({
			issues: [{ message: 'global' }],
		})
		expect(v.number({
			'number:expected_number': () => null,
		}).execute('wrong')).toMatchObject({
			issues: [{ message: 'global' }],
		})
	})

	it('converts a throwing message handler into a structured internal issue', () => {
		const error = new Error('message failure')
		const v = createValchecker({
			steps: [number],
			message: () => {
				throw error
			},
		})
		const result = v.number().execute('wrong')

		expect(result).toMatchObject({
			issues: [{
				code: 'core:message_exception',
				category: 'internal',
				message: 'An unexpected error occurred while resolving an issue message.',
				path: [],
				payload: {
					source: 'global',
					error,
					unresolvedIssue: {
						code: 'number:expected_number',
						category: 'validation',
						payload: { value: 'wrong' },
						path: [],
					},
				},
			}],
		})
	})

	it('reports the message scope that threw', () => {
		const v = createValchecker({ steps: [number, object] })
		const result = v.object({ age: v.number() }, {
			'number:expected_number': () => {
				throw new Error('context failure')
			},
		}).execute({ age: 'wrong' })

		expect(result).toMatchObject({
			issues: [{
				code: 'core:message_exception',
				category: 'internal',
				path: ['age'],
				payload: {
					source: 'context',
					unresolvedIssue: { path: ['age'] },
				},
			}],
		})
	})
})

const coveragePlugin = implStepPlugin<any>({
	scoped: ({ utils: { addSuccessStep, createIssue, failure, prependIssuePath } }: any) => {
		addSuccessStep(() => failure(prependIssuePath(createIssue({
			code: 'coverage:scoped',
			payload: {},
			defaultMessage: 'default',
		}), [], 'scope')))
	},
	contextual: ({ utils: { addSuccessStep, createIssue, failure } }: any) => {
		addSuccessStep(() => failure(createIssue({
			code: 'coverage:contextual',
			payload: {},
			context: [{ type: 'coverage', marker: 1 }],
			defaultMessage: 'default',
		})))
	},
	emptyFailure: ({ utils: { addSuccessStep, failure } }: any) => {
		addSuccessStep(() => failure([]))
	},
	asyncFirst: ({ utils: { addSuccessStep, success } }: any) => {
		addSuccessStep(async (value: unknown) => success(value))
	},
	second: ({ utils: { addSuccessStep, success } }: any) => {
		addSuccessStep((value: unknown) => success(value))
	},
})

describe('issue finalization coverage contracts', () => {
	it('supports a message scope without changing the issue path', () => {
		const v = createValchecker({ steps: [coveragePlugin] }) as any
		expect(v.scoped().execute('value')).toMatchObject({
			issues: [{ message: 'scope', path: [] }],
		})
	})

	it('preserves issue context when message resolution fails', () => {
		const v = createValchecker({
			steps: [coveragePlugin],
			message: () => {
				throw new Error('message failure')
			},
		}) as any
		expect(v.contextual().execute('value')).toMatchObject({
			issues: [{
				code: 'core:message_exception',
				context: [{ type: 'coverage', marker: 1 }],
				payload: {
					unresolvedIssue: {
						context: [{ type: 'coverage', marker: 1 }],
					},
				},
			}],
		})
	})

	it('turns an empty failure array into an internal execution issue', () => {
		const v = createValchecker({ steps: [coveragePlugin] }) as any
		expect(v.emptyFailure().execute('value')).toMatchObject({
			issues: [{
				code: 'core:unknown_exception',
				category: 'internal',
				payload: { error: expect.any(TypeError) },
			}],
		})
	})

	it('finalizes a two-step pipeline whose first step is async', async () => {
		const v = createValchecker({ steps: [coveragePlugin] }) as any
		await expect(v.asyncFirst().second().execute('value')).resolves.toEqual({ value: 'value' })
	})
})
