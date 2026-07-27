import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, TStepPluginDef } from '../../core'
import type { TUnionShorthandDef } from './union-shorthand'
import { describe, expect, it, vi } from 'vitest'
import { createValchecker, implStepPlugin, literal, null_, number, string, transform, undefined_, union, unknown } from '../..'
import { structuralFixture } from '../../test-utils/fixtures'
import { getLiteralMembers } from '../literal/literal-members'
import { unionShorthandCapability } from './union-shorthand'

const unionFixture = structuralFixture

const v = createValchecker({
	steps: [literal, null_, number, string, transform, undefined_, union, unionFixture, unknown],
})
const symbolShorthand = Symbol('shorthand')

describe('union step plugin', () => {
	it.each([
		['first', v.union([v.string(), v.number()]), 'hello', 'hello'],
		['later', v.union([v.string(), v.number()]), 42, 42],
		[
			'transformed',
			v.union([
				v.number(),
				v.string()
					.transform(value => value.toUpperCase()),
			]),
			'hello',
			'HELLO',
		],
	] as const)('returns the %s successful branch output', (_case, schema, input, output) => {
		expect(schema.execute(input as never))
			.toEqual({ value: output })
	})

	it.each([
		['literal string', v.union(['ready']), 'ready'],
		['literal number', v.union([42]), 42],
		['literal bigint', v.union([42n]), 42n],
		['literal boolean', v.union([true]), true],
		['literal symbol', v.union([symbolShorthand]), symbolShorthand],
		['null', v.union([null]), null],
		['undefined', v.union([undefined]), undefined],
	] as const)('normalizes the %s shorthand through its registered provider', (_case, schema, input) => {
		expect(schema.execute(input as never))
			.toEqual({ value: input })
	})

	it('keeps shorthand behavior identical to explicit provider schemas', () => {
		const shorthand = v.union(['auto', null, undefined])
		const explicit = v.union([v.literal('auto'), v.null(), v.undefined()])

		expect(shorthand.execute(false as never))
			.toEqual(explicit.execute(false as never))
	})

	it('uses Object.is semantics inherited from literal shorthand schemas', () => {
		expect(v.union([Number.NaN])
			.execute(Number.NaN))
			.toEqual({ value: Number.NaN })
		expect(v.union([-0])
			.execute(0))
			.toMatchObject({
				issues: [{ code: 'literal:expected_literal' }],
			})
		expect(v.union([0])
			.execute(-0))
			.toMatchObject({
				issues: [{ code: 'literal:expected_literal' }],
			})
	})

	it('preserves declaration order between schemas and shorthand branches', () => {
		const schema = v.union([
			v.number()
				.transform(() => 'number-schema' as const),
			1,
		])

		expect(schema.execute(1))
			.toEqual({ value: 'number-schema' })
	})

	it('aggregates recoverable branch issues with stable branch context', () => {
		expect(v.union([v.string(), v.number()])
			.execute(null))
			.toEqual({
				issues: [
					{
						code: 'string:expected_string',
						category: 'validation',
						message: 'Expected a string.',
						path: [],
						context: [{ type: 'union', branchIndex: 0 }],
						payload: { value: null },
					},
					{
						code: 'number:expected_number',
						category: 'validation',
						message: 'Expected a number.',
						path: [],
						context: [{ type: 'union', branchIndex: 1 }],
						payload: { value: null },
					},
				],
			})
	})

	it('uses the same global message resolver for generated shorthand schemas', () => {
		const custom = createValchecker({
			steps: [literal, union],
			message: ({ code }) => `global:${code}`,
		})

		expect(custom.union(['ready'])
			.execute('other'))
			.toMatchObject({
				issues: [{
					code: 'literal:expected_literal',
					message: 'global:literal:expected_literal',
					context: [{ type: 'union', branchIndex: 0 }],
				}],
			})
	})

	it('continues after an asynchronous recoverable branch failure', async () => {
		const later = vi.fn((value: string) => value)
		const result = v.union([
			v.string()
				.transform(async () => {
					throw new Error('recoverable')
				}),
			v.string()
				.transform(later),
			v.number(),
		])
			.execute('hello')

		expect(result)
			.toBeInstanceOf(Promise)
		await expect(result).resolves.toEqual({ value: 'hello' })
		expect(later)
			.toHaveBeenCalledOnce()
	})

	it('does not evaluate later branches after a synchronous internal failure', () => {
		const later = vi.fn()
		const schema = (v as any).union([
			v.number(),
			(v as any).unknown()
				.internalFailure(),
			(v as any).unknown()
				.observe(later),
		])
		const result = schema.execute('value')

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					context: [{ type: 'union', branchIndex: 1 }],
					payload: { method: 'internalFailure' },
				}],
			})
		expect((result as any).issues)
			.toHaveLength(1)
		expect(later).not.toHaveBeenCalled()
	})

	it('does not evaluate later branches after an asynchronous internal failure', async () => {
		const later = vi.fn()
		const schema = (v as any).union([
			v.number(),
			(v as any).unknown()
				.asyncInternalFailure(),
			(v as any).unknown()
				.observe(later),
		])
		const result = schema.execute('value')

		expect(result)
			.toBeInstanceOf(Promise)
		await expect(result).resolves.toMatchObject({
			issues: [{
				code: 'core:unknown_exception',
				category: 'internal',
				context: [{ type: 'union', branchIndex: 1 }],
				payload: { method: 'asyncInternalFailure' },
			}],
		})
		expect(later).not.toHaveBeenCalled()
	})

	it('rejects invalid branch collections during schema construction', () => {
		expect(() => (v as any).union([]))
			.toThrowError('union() requires at least one branch.')
		// eslint-disable-next-line no-sparse-arrays -- the array hole at index 0 is the fixture: it asserts union() rejects a missing branch
		expect(() => (v as any).union([, v.string()]))
			.toThrowError('union() branch at index 0 is missing.')
		expect(() => (v as any).union([{}]))
			.toThrowError('Invalid union branch at index 0: it is neither a schema nor a value any registered shorthand provider accepts.')
	})

	it('rejects shorthand values whose provider step is not registered', () => {
		// Branch resolution goes through the providers registered on the instance,
		// so an unregistered provider means nothing claims the value. The type
		// level already rejects these calls; this covers the runtime escape.
		const schemaOnly = createValchecker({ steps: [union] }) as any
		const rejection = 'it is neither a schema nor a value any registered shorthand provider accepts'

		expect(() => schemaOnly.union(['value']))
			.toThrowError(rejection)
		expect(() => schemaOnly.union([null]))
			.toThrowError(rejection)
		expect(() => schemaOnly.union([undefined]))
			.toThrowError(rejection)
	})

	it('resolves a third-party shorthand provider registered by a plugin', () => {
		// The mechanism is open: a plugin outside this package can teach `union` a
		// new shorthand by declaring the capability, with no change here.
		interface DateShorthandDef extends TUnionShorthandDef {
			input: Date
			operationMode: 'sync'
			output: Date
			issue: ExecutionIssue<'dateBranch:expected_date', { value: unknown }>
		}
		interface DatePluginDef extends TStepPluginDef {
			Capabilities: { UnionShorthand: DateShorthandDef }
			dateBranch: DefineStepMethod<
				DefineStepMethodMeta<{
					Name: 'dateBranch'
					ExpectedCurrentValchecker: DefineExpectedValchecker
					SelfIssue: ExecutionIssue<'dateBranch:expected_date', { value: unknown }>
				}>,
				this['CurrentValchecker'] extends infer This extends DefineExpectedValchecker
					? (expected: Date) => Next<{ output: Date }, This>
					: never
			>
		}

		const dateBranch = implStepPlugin<DatePluginDef>({
			dateBranch: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [expected] }) => {
				addSuccessStep(value => value instanceof Date && value.getTime() === expected.getTime()
					? success(value)
					: failure(createIssue({
							code: 'dateBranch:expected_date',
							payload: { value },
							defaultMessage: 'Expected the declared date.',
						})))
			},
		}, 'sync', {
			[unionShorthandCapability]: {
				matches: (branch: unknown) => branch instanceof Date,
				method: 'dateBranch',
				toParams: (branch: unknown) => [branch],
			},
		})

		const moment = new Date('2026-07-27T00:00:00.000Z')
		const w = createValchecker({ steps: [union, string, dateBranch] }) as any
		const schema = w.union([moment, w.string()])

		expect(schema.execute(new Date(moment.getTime())))
			.toEqual({ value: new Date(moment.getTime()) })
		expect(schema.execute('text'))
			.toEqual({ value: 'text' })
		// A failing union reports every branch's issues, so the third-party branch
		// contributes its own alongside the string branch's.
		expect(schema.execute(new Date('2020-01-01T00:00:00.000Z')))
			.toMatchObject({
				issues: [
					{ code: 'dateBranch:expected_date', context: [{ type: 'union', branchIndex: 0 }] },
					{ code: 'string:expected_string', context: [{ type: 'union', branchIndex: 1 }] },
				],
			})
	})

	it('surfaces a provider naming a step its plugin does not register', () => {
		// A capability is a claim, and a wrong claim has to fail loudly: the
		// provider matches the branch and then names a method nobody registered.
		const brokenProvider = implStepPlugin<any>({
			brokenBranch: ({ utils: { addSuccessStep, success } }: any) => addSuccessStep(success),
		} as any, 'sync', {
			[unionShorthandCapability]: {
				matches: (branch: unknown) => typeof branch === 'bigint',
				method: 'notRegistered',
			},
		})

		const w = createValchecker({ steps: [union, brokenProvider] }) as any

		expect(() => w.union([1n]))
			.toThrowError('Required step method is not registered: notRegistered')
	})

	it('resolves shorthand providers independently of registration order', () => {
		const reordered = createValchecker({
			steps: [union, undefined_, null_, literal],
		})

		expect(reordered.union(['ready', null, undefined])
			.execute(undefined))
			.toEqual({
				value: undefined,
			})
	})

	describe('literal member declaration', () => {
		it('combines member sets when every branch advertises one', () => {
			expect(getLiteralMembers(v.union(['a', 'b'])))
				.toEqual(['a', 'b'])
			expect(getLiteralMembers(v.union([v.literal('a'), 1])))
				.toEqual(['a', 1])
		})

		it('drops the member set when any branch is open', () => {
			expect(getLiteralMembers(v.union([v.string(), 'a'])))
				.toBeUndefined()
			// null/undefined shorthands do not advertise members.
			expect(getLiteralMembers(v.union(['a', null])))
				.toBeUndefined()
		})
	})
})
