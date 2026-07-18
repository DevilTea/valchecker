import { describe, expect, it } from 'vitest'
import { array, number, object } from '../steps'
import { createValchecker, implStepPlugin } from './core'

const frozenExternalIssue = Object.freeze({
	code: 'fixture:external',
	category: 'validation',
	payload: Object.freeze({ marker: true }),
	message: 'external default',
	path: Object.freeze([]),
})

const messageFixturePlugin = implStepPlugin<any>({
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

	it('supports a message scope without changing an empty issue path', () => {
		const v = createValchecker({ steps: [messageFixturePlugin] }) as any
		expect(v.scoped()
			.execute('value'))
			.toMatchObject({
				issues: [{ message: 'scope', path: [] }],
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
				}),
				messages: ['dynamic:first', 'Expected a number.'],
			},
			{
				schema: v.object({
					first: v.number(),
					second: v.number({ message: () => 'dynamic:second' }),
				}),
				messages: ['Expected a number.', 'dynamic:second'],
			},
			{
				schema: v.object({
					first: v.number({ message: () => 'dynamic:first' }),
					second: v.number({ message: () => 'dynamic:second' }),
				}),
				messages: ['dynamic:first', 'dynamic:second'],
			},
			{
				schema: v.object({ first: v.number(), second: v.number() }),
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
			if ('issues' in result) {
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
					payload: { error: expect.any({ message: TypeError }) },
				}],
			})
	})
})
