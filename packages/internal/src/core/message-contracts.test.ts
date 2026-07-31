import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, MessageHandler, Next, TStepPluginDef, TValchecker } from './types'
import { describe, expect, it } from 'vitest'
import { array, number, object, string, toAsync, tuple } from '../steps'
import { createValchecker, implStepPlugin, resolveMessagePriority, resolveStaticIssueMessage } from './core'

type MessageFixtureMeta = DefineStepMethodMeta<{
	Name: 'messageFixture'
	ExpectedCurrentValchecker: DefineExpectedValchecker
}>

// One nullary step-method signature shared by every message fixture method.
type FixtureStep<This extends TValchecker> = () => Next<undefined, This>

interface MessageFixtureDef extends TStepPluginDef {
	scoped: DefineStepMethod<MessageFixtureMeta, this['CurrentValchecker'] extends infer This extends MessageFixtureMeta['ExpectedCurrentValchecker'] ? FixtureStep<This> : never>
	contextual: DefineStepMethod<MessageFixtureMeta, this['CurrentValchecker'] extends infer This extends MessageFixtureMeta['ExpectedCurrentValchecker'] ? FixtureStep<This> : never>
	external: DefineStepMethod<MessageFixtureMeta, this['CurrentValchecker'] extends infer This extends MessageFixtureMeta['ExpectedCurrentValchecker'] ? FixtureStep<This> : never>
	dynamicDefault: DefineStepMethod<MessageFixtureMeta, this['CurrentValchecker'] extends infer This extends MessageFixtureMeta['ExpectedCurrentValchecker'] ? FixtureStep<This> : never>
	dynamicCustom: DefineStepMethod<MessageFixtureMeta, this['CurrentValchecker'] extends infer This extends MessageFixtureMeta['ExpectedCurrentValchecker'] ? FixtureStep<This> : never>
	noMessage: DefineStepMethod<MessageFixtureMeta, this['CurrentValchecker'] extends infer This extends MessageFixtureMeta['ExpectedCurrentValchecker'] ? FixtureStep<This> : never>
	emptyFailure: DefineStepMethod<MessageFixtureMeta, this['CurrentValchecker'] extends infer This extends MessageFixtureMeta['ExpectedCurrentValchecker'] ? FixtureStep<This> : never>
	throwingCustom: DefineStepMethod<MessageFixtureMeta, this['CurrentValchecker'] extends infer This extends MessageFixtureMeta['ExpectedCurrentValchecker'] ? FixtureStep<This> : never>
	throwingDefault: DefineStepMethod<MessageFixtureMeta, this['CurrentValchecker'] extends infer This extends MessageFixtureMeta['ExpectedCurrentValchecker'] ? FixtureStep<This> : never>
	replaceScoped: DefineStepMethod<MessageFixtureMeta, this['CurrentValchecker'] extends infer This extends MessageFixtureMeta['ExpectedCurrentValchecker'] ? FixtureStep<This> : never>
	tiered: DefineStepMethod<
		MessageFixtureMeta,
		this['CurrentValchecker'] extends infer This extends MessageFixtureMeta['ExpectedCurrentValchecker']
			? (
					customMessage: MessageHandler<any> | undefined,
					defaultMessage: MessageHandler<any> | undefined,
				) => Next<undefined, This>
			: never
	>
}

const frozenExternalIssue = Object.freeze({
	code: 'fixture:external',
	category: 'validation',
	payload: Object.freeze({ marker: true }),
	message: 'external default',
	path: Object.freeze([]),
})

const messageFixturePlugin = implStepPlugin<MessageFixtureDef>({
	scoped: ({ utils: { addSuccessStep, createIssue, failure, prependIssuePath } }: any) => {
		addSuccessStep(() => failure(prependIssuePath(createIssue({
			code: 'fixture:scoped',
			payload: {},
			defaultMessage: 'default',
		}), [], 'scope')))
	},
	contextual: ({ utils: { addSuccessStep, createIssue, failure } }: any) => {
		addSuccessStep(() => failure(createIssue({
			code: 'fixture:contextual',
			payload: {},
			context: [{ type: 'fixture', marker: 1 }],
			defaultMessage: 'default',
		})))
	},
	external: ({ utils: { addSuccessStep, failure } }: any) => {
		addSuccessStep(() => failure(frozenExternalIssue as any))
	},
	dynamicDefault: ({ utils: { addSuccessStep, createIssue, failure } }: any) => {
		addSuccessStep(() => failure(createIssue({
			code: 'fixture:dynamic_default',
			payload: {},
			defaultMessage: () => 'dynamic default',
		})))
	},
	dynamicCustom: ({ utils: { addSuccessStep, createIssue, failure } }: any) => {
		addSuccessStep(() => failure(createIssue({
			code: 'fixture:dynamic_custom',
			payload: {},
			customMessage: () => 'dynamic custom',
		})))
	},
	noMessage: ({ utils: { addSuccessStep, createIssue, failure } }: any) => {
		addSuccessStep(() => failure(createIssue({
			code: 'fixture:no_message',
			payload: {},
		})))
	},
	emptyFailure: ({ utils: { addSuccessStep, failure } }: any) => {
		addSuccessStep(() => failure([]))
	},
	throwingCustom: ({ utils: { addSuccessStep, createIssue, failure } }: any) => {
		addSuccessStep(() => failure(createIssue({
			code: 'fixture:throwing_custom',
			payload: {},
			customMessage: () => {
				throw new Error('step failure')
			},
			defaultMessage: 'default',
		})))
	},
	throwingDefault: ({ utils: { addSuccessStep, createIssue, failure } }: any) => {
		addSuccessStep(() => failure(createIssue({
			code: 'fixture:throwing_default',
			payload: {},
			defaultMessage: () => {
				throw new Error('default failure')
			},
		})))
	},
	// Both message tiers come from the caller, so one step can be driven through every
	// combination the resolver distinguishes.
	tiered: ({ utils: { addSuccessStep, createIssue, failure }, params: [customMessage, defaultMessage] }: any) => {
		addSuccessStep(() => failure(createIssue({
			code: 'fixture:tiered',
			payload: {},
			customMessage,
			defaultMessage,
		})))
	},
	// A statically resolved issue (no dynamic handler anywhere) carries no draft
	// metadata, so the scope handed to `replaceIssuePath` is the only thing that
	// can still change its message.
	replaceScoped: ({ utils: { addSuccessStep, createIssue, failure, replaceIssuePath } }: any) => {
		addSuccessStep(() => failure(replaceIssuePath(createIssue({
			code: 'fixture:replace_scoped',
			payload: {},
			path: ['original'],
			defaultMessage: 'default',
		}), ['moved'], () => 'replaced scope')))
	},
})

describe('issue message finalization', () => {
	it('resolves a leaf handler once with the final object path', () => {
		let calls = 0
		let receivedPath: PropertyKey[] | undefined
		const v = createValchecker({ steps: [number, object] })
		const schema = v.object({
			age: v.number({ message: ({ path }) => {
				calls++
				receivedPath = path
				return `Invalid ${String(path[0])}`
			} }),
		})

		expect(schema.execute({ age: 'wrong' }))
			.toEqual({
				issues: [{
					code: 'number:expected_number',
					category: 'validation',
					message: 'Invalid age',
					path: ['age'],
					payload: { value: 'wrong' },
				}],
			})
		expect(calls)
			.toBe(1)
		expect(receivedPath)
			.toEqual(['age'])
	})

	it('resolves every issue exactly once across nesting, collect-all, and async finalization', async () => {
		let calls = 0
		const v = createValchecker({
			steps: [number, object, toAsync],
			// The running count is baked into the message, so a second resolution of
			// the same issue is visible in the result and not only in the counter.
			message: () => `resolved:${++calls}`,
		})

		expect(v.object({ profile: v.object({ age: v.number() }) })
			.execute({ profile: { age: 'wrong' } }))
			.toMatchObject({
				issues: [{ message: 'resolved:1' }],
			})
		expect(calls)
			.toBe(1)

		calls = 0
		expect(v.object({ first: v.number(), second: v.number() }, { collectAllIssues: true })
			.execute({ first: 'wrong', second: 'wrong' }))
			.toMatchObject({
				issues: [{ message: 'resolved:1' }, { message: 'resolved:2' }],
			})
		expect(calls)
			.toBe(2)

		calls = 0
		await expect(v.object({ age: v.number() })
			.toAsync()
			.execute({ age: 'wrong' })).resolves.toMatchObject({
			issues: [{ message: 'resolved:1' }],
		})
		expect(calls)
			.toBe(1)
	})

	it('uses the originating step message before an enclosing structure', () => {
		// Every tier below the step is populated and answers, so only correct
		// precedence can produce `step`.
		const v = createValchecker({
			steps: [number, object],
			message: () => 'global',
		})
		const schema = v.object({
			age: v.number({ message: () => 'step' }),
		}, { message: {
			'number:expected_number': () => 'structure',
		} })

		expect(schema.execute({ age: 'wrong' }))
			.toMatchObject({
				issues: [{ message: 'step', path: ['age'] }],
			})
	})

	it('uses the nearest enclosing structure before outer and global handlers', () => {
		const v = createValchecker({
			steps: [number, object],
			message: () => 'global',
		})
		const schema = v.object({
			profile: v.object({
				age: v.number(),
			}, { message: {
				'number:expected_number': ({ path }) => `inner:${path.join('.')}`,
			} }),
		}, { message: {
			'number:expected_number': () => 'outer',
		} })

		expect(schema.execute({ profile: { age: 'wrong' } }))
			.toMatchObject({
				issues: [{ message: 'inner:profile.age', path: ['profile', 'age'] }],
			})
	})

	it('walks past a declining enclosing structure to the next outer one before the global handler', () => {
		// Three enclosing scopes at once. The nearest declines this issue, so the
		// next one out must answer: not the outermost, and not the global. Nothing
		// short of the full scope chain, walked nearest-first, produces `middle`.
		const v = createValchecker({
			steps: [number, object],
			message: () => 'global',
		})
		const schema = v.object({
			a: v.object({
				b: v.object({ age: v.number() }, { message: {
					'number:expected_number': () => null,
				} }),
			}, { message: {
				'number:expected_number': () => 'middle',
			} }),
		}, { message: {
			'number:expected_number': () => 'outermost',
		} })

		expect(schema.execute({ a: { b: { age: 'wrong' } } }))
			.toMatchObject({
				issues: [{ message: 'middle', path: ['a', 'b', 'age'] }],
			})
	})

	it('preserves the originating instance resolver unless an enclosing scope overrides it', () => {
		const childV = createValchecker({
			steps: [number],
			message: ({ path }) => `child:${path.join('.')}`,
		})
		const outerV = createValchecker({
			steps: [object],
			message: () => 'outer-global',
		})

		expect(outerV.object({ value: childV.number() })
			.execute({ value: 'wrong' }))
			.toMatchObject({
				issues: [{ message: 'child:value', path: ['value'] }],
			})

		expect(outerV.object({ value: childV.number() }, { message: {
			'number:expected_number': () => 'outer-scope',
		} })
			.execute({ value: 'wrong' }))
			.toMatchObject({
				issues: [{ message: 'outer-scope', path: ['value'] }],
			})
	})

	it('resolves array child messages with their final item path', () => {
		let receivedPath: PropertyKey[] | undefined
		const v = createValchecker({ steps: [array, number] })
		const schema = v.array(v.number({ message: ({ path }) => {
			receivedPath = path
			return `item:${String(path[0])}`
		} }))

		expect(schema.execute(['wrong']))
			.toMatchObject({
				issues: [{ message: 'item:0', path: [0] }],
			})
		expect(receivedPath)
			.toEqual([0])
	})

	/**
	 * `replaceIssuePath` overwrites a child's path outright, and `tuple`'s rest region is its
	 * only production caller. The scopes an issue has already collected on the way out have
	 * to survive that rewrite: an inner structure's message is nearer than the tuple's and
	 * must still win. Dropping the accumulated list and keeping only the new scope is
	 * invisible to every other test, because nothing else nests a scoped structure inside a
	 * rest region.
	 */
	it('keeps the scopes a child already collected when a rest region replaces its path', () => {
		const v = createValchecker({ steps: [array, string, tuple] })
		const schema = v.tuple(['...', v.array(v.string(), { message: 'INNER' })], { message: 'OUTER' })

		expect(schema.execute([1]))
			.toMatchObject({
				issues: [{ code: 'string:expected_string', message: 'INNER', path: [0] }],
			})

		// Without an inner scope the tuple's own message is what remains nearest.
		expect(v.tuple(['...', v.array(v.string())], { message: 'OUTER' })
			.execute([1]))
			.toMatchObject({ issues: [{ message: 'OUTER' }] })
	})

	it.each([null, undefined])('continues to the global handler when a step map returns %s', (emptyMessage) => {
		const v = createValchecker({
			steps: [number],
			message: () => 'global',
		})

		expect(v.number({ message: {
			'number:expected_number': () => emptyMessage,
		} })
			.execute('wrong'))
			.toMatchObject({
				issues: [{ message: 'global' }],
			})
	})

	it('converts a throwing global handler into an immutable internal issue snapshot', () => {
		const error = new Error('message failure')
		const v = createValchecker({
			steps: [number],
			message: () => {
				throw error
			},
		})
		const result = v.number()
			.execute('wrong')

		expect(result)
			.toMatchObject({
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

	it('reports a throwing enclosing scope and copies the unresolved path', () => {
		const v = createValchecker({ steps: [number, object] })
		const result = v.object({ age: v.number() }, { message: {
			'number:expected_number': () => {
				throw new Error('context failure')
			},
		} })
			.execute({ age: 'wrong' })

		expect(result)
			.toMatchObject({
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

		const issue = (result as any).issues[0]
		const unresolvedPath = issue.payload.unresolvedIssue.path
		expect(unresolvedPath).not.toBe(issue.path)
		issue.path.push('mutated')
		expect(unresolvedPath)
			.toEqual(['age'])
	})

	it.each([
		['step', 'throwingCustom'],
		['default', 'throwingDefault'],
	] as const)('reports a throwing %s handler as a message exception naming its tier', (source, method) => {
		const v = createValchecker({ steps: [messageFixturePlugin] }) as any

		expect(v[method]()
			.execute('value'))
			.toMatchObject({
				issues: [{
					code: 'core:message_exception',
					category: 'internal',
					payload: {
						source,
						error: expect.objectContaining({ message: `${source} failure` }),
					},
				}],
			})
	})

	it('supports a message scope without changing an empty issue path', () => {
		const v = createValchecker({ steps: [messageFixturePlugin] }) as any
		expect(v.scoped()
			.execute('value'))
			.toMatchObject({
				issues: [{ message: 'scope', path: [] }],
			})
	})

	it('applies a message scope attached while an issue path is replaced', () => {
		const v = createValchecker({ steps: [messageFixturePlugin] }) as any
		expect(v.replaceScoped()
			.execute('value'))
			.toMatchObject({
				issues: [{ message: 'replaced scope', path: ['moved'] }],
			})
	})

	it('preserves and copies issue context when message resolution fails', () => {
		const v = createValchecker({
			steps: [messageFixturePlugin],
			message: () => {
				throw new Error('message failure')
			},
		}) as any
		const result = v.contextual()
			.execute('value')

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'core:message_exception',
					context: [{ type: 'fixture', marker: 1 }],
					payload: {
						unresolvedIssue: {
							context: [{ type: 'fixture', marker: 1 }],
						},
					},
				}],
			})

		const issue = result.issues[0]
		const unresolvedContext = issue.payload.unresolvedIssue.context
		expect(unresolvedContext).not.toBe(issue.context)
		issue.context.push({ type: 'mutated' })
		expect(unresolvedContext)
			.toEqual([{ type: 'fixture', marker: 1 }])
	})

	it('applies an enclosing scope to a frozen external issue without mutating or consuming it', () => {
		const v = createValchecker({ steps: [messageFixturePlugin, object] }) as any
		const schema = v.object({ value: v.external() }, { message: {
			'fixture:external': ({ path }: any) => `object:${path.join('.')}`,
		} })

		for (let i = 0; i < 2; i++) {
			expect(schema.execute({ value: 'input' }))
				.toEqual({
					issues: [{
						code: 'fixture:external',
						category: 'validation',
						payload: { marker: true },
						message: 'object:value',
						path: ['value'],
					}],
				})
		}
		expect(frozenExternalIssue)
			.toEqual({
				code: 'fixture:external',
				category: 'validation',
				payload: { marker: true },
				message: 'external default',
				path: [],
			})
	})

	it('resolves static global, dynamic default, dynamic custom, and fallback messages', () => {
		const staticGlobal = createValchecker({
			steps: [number],
			message: 'global string',
		})
		expect(staticGlobal.number()
			.execute('wrong'))
			.toMatchObject({
				issues: [{ message: 'global string' }],
			})
		expect(staticGlobal.number({ message: () => undefined })
			.execute('wrong'))
			.toMatchObject({
				issues: [{ message: 'global string' }],
			})

		const v = createValchecker({ steps: [messageFixturePlugin] }) as any
		expect(v.dynamicDefault()
			.execute('value'))
			.toMatchObject({
				issues: [{ message: 'dynamic default' }],
			})
		expect(v.dynamicCustom()
			.execute('value'))
			.toMatchObject({
				issues: [{ message: 'dynamic custom' }],
			})
		expect(v.noMessage()
			.execute('value'))
			.toMatchObject({
				issues: [{ message: 'Invalid value.' }],
			})
	})

	it('finalizes mixed multi-issue results without exposing draft metadata', () => {
		const v = createValchecker({ steps: [number, object] })
		const cases = [
			{
				schema: v.object({
					first: v.number({ message: () => 'dynamic:first' }),
					second: v.number(),
				}, { collectAllIssues: true }),
				messages: ['dynamic:first', 'Expected a number.'],
			},
			{
				schema: v.object({
					first: v.number(),
					second: v.number({ message: () => 'dynamic:second' }),
				}, { collectAllIssues: true }),
				messages: ['Expected a number.', 'dynamic:second'],
			},
			{
				schema: v.object({
					first: v.number({ message: () => 'dynamic:first' }),
					second: v.number({ message: () => 'dynamic:second' }),
				}, { collectAllIssues: true }),
				messages: ['dynamic:first', 'dynamic:second'],
			},
			{
				schema: v.object({ first: v.number(), second: v.number() }, { collectAllIssues: true }),
				messages: ['Expected a number.', 'Expected a number.'],
			},
		]

		for (const { schema, messages } of cases) {
			const result = schema.execute({ first: 'wrong', second: 'wrong' })
			expect(result)
				.toMatchObject({
					issues: [
						{ message: messages[0], path: ['first'] },
						{ message: messages[1], path: ['second'] },
					],
				})
			if (result.issues != null) {
				for (const issue of result.issues) {
					expect(Object.getOwnPropertySymbols(issue))
						.toEqual([])
				}
			}
		}
	})

	it('applies a dynamic global handler to normalized execution failures', () => {
		const v = createValchecker({
			steps: [messageFixturePlugin],
			message: ({ code }: any) => `global:${code}`,
		}) as any

		expect(v.emptyFailure()
			.execute('value'))
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					message: 'global:core:unknown_exception',
				}],
			})
	})

	it('turns an empty failure collection into an internal execution issue', () => {
		const v = createValchecker({ steps: [messageFixturePlugin] }) as any
		expect(v.emptyFailure()
			.execute('value'))
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					payload: { error: expect.any(TypeError) },
				}],
			})
	})
})

describe('static and dynamic message resolution parity', () => {
	const code = 'test:matrix'
	const data = { code, category: 'validation' as const, payload: {}, path: [] }

	// Handler shapes exercised at each precedence tier. `mapMiss` is transparent
	// (behaves like an absent handler) for both paths; `fn` and `mapHit` are
	// dynamic and force deferral in the static path.
	const shapes: { name: string, handler: (tier: string) => MessageHandler<any> | undefined }[] = [
		{ name: 'absent', handler: () => undefined },
		{ name: 'string', handler: tier => `S:${tier}` },
		{ name: 'fn', handler: tier => () => `D:${tier}` },
		{ name: 'mapHit', handler: tier => ({ [code]: () => `M:${tier}` }) },
		{ name: 'mapMiss', handler: () => ({ 'other:code': () => 'X' }) },
	]

	it('never lets statically resolved messages disagree with dynamic resolution', () => {
		for (const custom of shapes) {
			for (const global of shapes) {
				for (const def of shapes) {
					const label = `${custom.name}/${global.name}/${def.name}`
					const customMessage = custom.handler('custom')
					const globalMessage = global.handler('global')
					const defaultMessage = def.handler('default')

					const staticMessage = resolveStaticIssueMessage(code, customMessage, globalMessage, defaultMessage)
					const dynamicMessage = resolveMessagePriority({
						data,
						customMessage,
						contextMessages: [],
						defaultMessage,
						globalMessage,
					})

					// Dynamic resolution always yields a concrete string.
					expect(typeof dynamicMessage, label)
						.toBe('string')
					// When static resolution commits to a message, it must match
					// what dynamic resolution would have produced.
					if (staticMessage !== undefined) {
						expect(staticMessage, label)
							.toBe(dynamicMessage)
					}
				}
			}
		}
	})

	/**
	 * The third mirror of the tier order. While resolution is deferred the issue still has
	 * to carry *a* message, and `~execute` hands that placeholder straight to a plugin author
	 * — only the public `execute()` replaces it. Its rule is the same order restricted to
	 * string handlers: custom, then global, then default, then the fallback. Nothing asserted
	 * it, so every tier of the placeholder could be rewritten unnoticed.
	 *
	 * Deferral is forced by a handler the static path cannot commit on: a plain-string custom
	 * message (a context scope could still override it) or a dynamic global.
	 */
	it('fills a deferred issue with the first string handler down the same tier order', () => {
		const dynamic = () => 'D:dynamic'
		const cases: Array<{ label: string, global: MessageHandler<any> | undefined, custom: MessageHandler<any> | undefined, default: MessageHandler<any> | undefined, placeholder: string }> = [
			{ label: 'custom string wins', global: dynamic, custom: 'S:custom', default: 'S:default', placeholder: 'S:custom' },
			{ label: 'global string when custom is dynamic', global: 'S:global', custom: dynamic, default: 'S:default', placeholder: 'S:global' },
			{ label: 'default string when custom and global are not strings', global: dynamic, custom: undefined, default: 'S:default', placeholder: 'S:default' },
			{ label: 'fallback when no tier holds a string', global: dynamic, custom: undefined, default: undefined, placeholder: 'Invalid value.' },
		]

		for (const testCase of cases) {
			const w = createValchecker({ steps: [messageFixturePlugin], message: testCase.global }) as any
			const schema = w.tiered(testCase.custom, testCase.default)

			expect(schema['~execute']('value'), testCase.label)
				.toMatchObject({ issues: [{ message: testCase.placeholder }] })
			// The placeholder is never what a consumer sees: `execute()` resolves it.
			expect(typeof (schema.execute('value') as any).issues[0].message, testCase.label)
				.toBe('string')
		}
	})

	it('commits statically for a fully-static handler shape', () => {
		// The matrix above only checks agreement when static resolution commits;
		// it would still pass if static resolution always deferred (returned
		// undefined). Pin one fully-static shape that MUST commit so a regression
		// killing static resolution entirely turns this red. A plain-string
		// custom message intentionally defers, so drive the commit through a
		// string global message with custom and default absent.
		const staticMessage = resolveStaticIssueMessage(code, undefined, 'S:global', undefined)
		expect(staticMessage)
			.toBe('S:global')
		expect(resolveMessagePriority({
			data,
			customMessage: undefined,
			contextMessages: [],
			defaultMessage: undefined,
			globalMessage: 'S:global',
		}))
			.toBe('S:global')
	})
})
