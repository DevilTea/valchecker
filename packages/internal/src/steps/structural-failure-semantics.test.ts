import type {
	DefineExpectedValchecker,
	DefineStepMethod,
	DefineStepMethodMeta,
	ExecutionIssue,
	Next,
	TStepPluginDef,
} from '../core'
import { describe, expect, it, vi } from 'vitest'
import {
	array,
	createValchecker,
	fallback,
	implStepPlugin,
	intersection,
	looseObject,
	number,
	object,
	strictObject,
	string,
	transform,
	union,
	unknown,
} from '..'

type FatalIssue = ExecutionIssue<'fatal:failed', { value: unknown }, 'internal'>
type FatalMeta = DefineStepMethodMeta<{
	Name: 'fatal'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: FatalIssue
}>
interface FatalPluginDef extends TStepPluginDef {
	fatal: DefineStepMethod<
		FatalMeta,
		this['CurrentValchecker'] extends FatalMeta['ExpectedCurrentValchecker']
			? (onRun?: () => void) => Next<{ issue: FatalIssue }, this['CurrentValchecker']>
			: never
	>
}
const fatal = implStepPlugin<FatalPluginDef>({
	fatal: ({ utils: { addSuccessStep, createIssue, failure }, params: [onRun] }) => {
		addSuccessStep((value) => {
			onRun?.()
			return failure(createIssue({
				code: 'fatal:failed',
				category: 'internal',
				payload: { value },
				defaultMessage: 'Fatal failure.',
			}))
		})
	},
})

type FatalAsyncIssue = ExecutionIssue<'fatalAsync:failed', { value: unknown }, 'internal'>
type FatalAsyncMeta = DefineStepMethodMeta<{
	Name: 'fatalAsync'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: FatalAsyncIssue
}>
interface FatalAsyncPluginDef extends TStepPluginDef {
	fatalAsync: DefineStepMethod<
		FatalAsyncMeta,
		this['CurrentValchecker'] extends FatalAsyncMeta['ExpectedCurrentValchecker']
			? (onRun?: () => void) => Next<{
					operationMode: 'maybe-async'
					issue: FatalAsyncIssue
				}, this['CurrentValchecker']>
			: never
	>
}
const fatalAsync = implStepPlugin<FatalAsyncPluginDef>({
	fatalAsync: ({ utils: { addSuccessStep, createIssue, failure }, params: [onRun] }) => {
		addSuccessStep(async (value) => {
			onRun?.()
			return failure(createIssue({
				code: 'fatalAsync:failed',
				category: 'internal',
				payload: { value },
				defaultMessage: 'Async fatal failure.',
			}))
		})
	},
})

const v = createValchecker({
	steps: [
		array,
		fallback,
		fatal,
		fatalAsync,
		intersection,
		looseObject,
		number,
		object,
		strictObject,
		string,
		transform,
		union,
		unknown,
	],
})

const variants = [
	['object', (schema: ReturnType<typeof v.number>) => v.object({ value: schema })],
	['strictObject', (schema: ReturnType<typeof v.number>) => v.strictObject({ value: schema })],
	['looseObject', (schema: ReturnType<typeof v.number>) => v.looseObject({ value: schema })],
] as const

describe('structural requiredness contract', () => {
	for (const [name, createSchema] of variants) {
		it(`${name} reports a missing own key instead of validating synthetic undefined`, () => {
			const result = createSchema(v.number())
				.execute({})
			expect(result)
				.toEqual({
					issues: [{
						code: `${name}:missing_key`,
						category: 'validation',
						message: 'Missing required object key.',
						path: ['value'],
						payload: { key: 'value' },
					}],
				})
		})

		it(`${name} validates an own property whose value is undefined`, () => {
			const result = createSchema(v.number())
				.execute({ value: undefined })
			expect(result)
				.toEqual({
					issues: [{
						code: 'number:expected_number',
						category: 'validation',
						message: 'Expected a number.',
						path: ['value'],
						payload: { value: undefined },
					}],
				})
		})
	}

	it('skips an absent optional child but emits an own undefined output property', () => {
		for (const schema of [
			v.object({ value: [v.number()] }),
			v.strictObject({ value: [v.number()] }),
			v.looseObject({ value: [v.number()] }),
		]) {
			const result = schema.execute({})
			expect(result)
				.toEqual({ value: { value: undefined } })
			if (v.isSuccess(result)) {
				expect(Object.hasOwn(result.value, 'value'))
					.toBe(true)
			}
		}
	})

	it('does not treat an inherited property as present', () => {
		const input = Object.create({ value: 1 })
		expect(v.object({ value: v.number() })
			.execute(input))
			.toMatchObject({ issues: [{ code: 'object:missing_key', path: ['value'] }] })
	})

	it('supports symbol keys and points missing-key paths at the symbol', () => {
		const key = Symbol('value')
		expect(v.object({ [key]: v.number() })
			.execute({ [key]: 1 }))
			.toEqual({ value: { [key]: 1 } })
		expect(v.object({ [key]: v.number() })
			.execute({}))
			.toEqual({
				issues: [{
					code: 'object:missing_key',
					category: 'validation',
					message: 'Missing required object key.',
					path: [key],
					payload: { key },
				}],
			})
	})

	it('continues structural requiredness checks after an asynchronous child', async () => {
		const first = v.number()
			.transform(async value => value)
		for (const [name, schema] of [
			['object', v.object({ first, missing: v.number(), optional: [v.number()] })],
			['strictObject', v.strictObject({ first, missing: v.number(), optional: [v.number()] })],
			['looseObject', v.looseObject({ first, missing: v.number(), optional: [v.number()] })],
		] as const) {
			await expect(schema.execute({ first: 1 })).resolves.toEqual({
				issues: [{
					code: `${name}:missing_key`,
					category: 'validation',
					message: 'Missing required object key.',
					path: ['missing'],
					payload: { key: 'missing' },
				}],
			})
		}
	})

	it('reads an enumerable own getter once per object execution', () => {
		const read = vi.fn(() => 1)
		const input = Object.defineProperty({}, 'value', {
			enumerable: true,
			get: read,
		})
		for (const schema of [
			v.object({ value: v.number() }),
			v.strictObject({ value: v.number() }),
			v.looseObject({ value: v.number() }),
		]) {
			expect(schema.execute(input))
				.toEqual({ value: { value: 1 } })
		}
		expect(read)
			.toHaveBeenCalledTimes(3)
	})

	it('strictObject aggregates unexpected, missing, and invalid known fields', () => {
		const result = v.strictObject({
			missing: v.string(),
			invalid: v.number(),
		})
			.execute({ invalid: 'bad', extra: true })
		expect(result)
			.toEqual({
				issues: [
					{
						code: 'strictObject:unexpected_keys',
						category: 'validation',
						message: 'Unexpected object keys found.',
						path: [],
						payload: { keys: ['extra'], expectedKeys: ['missing', 'invalid'] },
					},
					{
						code: 'strictObject:missing_key',
						category: 'validation',
						message: 'Missing required object key.',
						path: ['missing'],
						payload: { key: 'missing' },
					},
					{
						code: 'number:expected_number',
						category: 'validation',
						message: 'Expected a number.',
						path: ['invalid'],
						payload: { value: 'bad' },
					},
				],
			})
	})
})

describe('fatal and recoverable propagation contract', () => {
	it('union records branch provenance without changing data paths', () => {
		const result = v.union([
			v.object({ value: v.string() }),
			v.object({ value: v.number() }),
		])
			.execute({ value: null })
		expect(result)
			.toMatchObject({
				issues: [
					{ code: 'string:expected_string', path: ['value'], context: [{ type: 'union', branchIndex: 0 }] },
					{ code: 'number:expected_number', path: ['value'], context: [{ type: 'union', branchIndex: 1 }] },
				],
			})
	})

	it('nested unions preserve inner-to-outer provenance and dynamic message metadata', () => {
		const result = v.union([
			v.union([
				v.string({ message: ({ context }) => `inner:${String(context?.length)}` }),
			]),
			v.number(),
		])
			.execute(null)
		expect(result)
			.toMatchObject({
				issues: [
					{
						code: 'string:expected_string',
						message: 'inner:2',
						context: [
							{ type: 'union', branchIndex: 0 },
							{ type: 'union', branchIndex: 0 },
						],
					},
					{
						code: 'number:expected_number',
						context: [{ type: 'union', branchIndex: 1 }],
					},
				],
			})
	})

	it('union immediately returns an internal branch failure instead of accepting a later branch', () => {
		const later = vi.fn()
		const result = v.union([
			v.fatal(),
			v.unknown()
				.transform((value) => { later(); return value }),
		])
			.execute('value')
		expect(later).not.toHaveBeenCalled()
		expect(result)
			.toMatchObject({
				issues: [{
					code: 'fatal:failed',
					category: 'internal',
					context: [{ type: 'union', branchIndex: 0 }],
				}],
			})
	})

	it('union discards earlier alternative failures when a later branch is internal', () => {
		const result = v.union([
			v.number(),
			v.fatal(),
			v.string(),
		])
			.execute('value')
		expect(result)
			.toEqual({
				issues: [{
					code: 'fatal:failed',
					category: 'internal',
					message: 'Fatal failure.',
					path: [],
					payload: { value: 'value' },
					context: [{ type: 'union', branchIndex: 1 }],
				}],
			})
	})

	it('object and array stop evaluating siblings/items after an internal issue', () => {
		const sibling = vi.fn((value: unknown) => value)
		const objectResult = v.object({
			fatal: v.fatal(),
			later: v.unknown()
				.transform(sibling),
		})
			.execute({ fatal: 1, later: 2 })
		expect(objectResult)
			.toMatchObject({ issues: [{ code: 'fatal:failed', path: ['fatal'] }] })
		expect(sibling).not.toHaveBeenCalled()

		const itemRun = vi.fn()
		const arrayResult = v.array(v.fatal(itemRun))
			.execute([1, 2, 3])
		expect(arrayResult)
			.toMatchObject({ issues: [{ code: 'fatal:failed', path: [0] }] })
		expect(itemRun)
			.toHaveBeenCalledTimes(1)
	})

	it('object variants and arrays stop after an asynchronous internal issue', async () => {
		for (const createSchema of [
			(later: () => void) => v.object({
				first: v.unknown()
					.transform(async value => value),
				fatal: v.fatalAsync(),
				later: v.unknown()
					.transform((value) => { later(); return value }),
			}),
			(later: () => void) => v.strictObject({
				first: v.unknown()
					.transform(async value => value),
				fatal: v.fatalAsync(),
				later: v.unknown()
					.transform((value) => { later(); return value }),
			}),
			(later: () => void) => v.looseObject({
				first: v.unknown()
					.transform(async value => value),
				fatal: v.fatalAsync(),
				later: v.unknown()
					.transform((value) => { later(); return value }),
			}),
		]) {
			const later = vi.fn()
			const result = await createSchema(later)
				.execute({ first: 1, fatal: 2, later: 3 })
			expect(result)
				.toMatchObject({
					issues: [{ code: 'fatalAsync:failed', path: ['fatal'] }],
				})
			expect(later).not.toHaveBeenCalled()
		}

		const itemRun = vi.fn()
		const result = await v.array(v.fatalAsync(itemRun))
			.execute([1, 2])
		expect(result)
			.toMatchObject({ issues: [{ code: 'fatalAsync:failed', path: [0] }] })
		expect(itemRun)
			.toHaveBeenCalledTimes(1)
	})

	it('union handles asynchronous recoverable and internal branch failures', async () => {
		const recoverable = () => v.unknown()
			.transform(async () => { throw new Error('recoverable') })
		const recoverableResult = await v.union([recoverable(), recoverable()])
			.execute('value')
		expect(recoverableResult)
			.toMatchObject({
				issues: [
					{ code: 'transform:callback_failed', context: [{ type: 'union', branchIndex: 0 }] },
					{ code: 'transform:callback_failed', context: [{ type: 'union', branchIndex: 1 }] },
				],
			})

		const later = vi.fn()
		const fatalResult = await v.union([
			recoverable(),
			v.fatalAsync(),
			v.unknown()
				.transform((value) => { later(); return value }),
		])
			.execute('value')
		expect(fatalResult)
			.toMatchObject({
				issues: [{ code: 'fatalAsync:failed', context: [{ type: 'union', branchIndex: 1 }] }],
			})
		if (v.isFailure(fatalResult)) {
			expect(fatalResult.issues)
				.toHaveLength(1)
		}
		expect(later).not.toHaveBeenCalled()
	})
})

describe('intersection conflict contract', () => {
	it('reports the nested conflict path and branch pair', () => {
		const result = v.intersection([
			v.unknown()
				.transform(() => ({ user: { id: 1 } })),
			v.unknown()
				.transform(() => ({ user: { id: 2 } })),
		])
			.execute(null)
		expect(result)
			.toEqual({
				issues: [{
					code: 'intersection:conflicting_outputs',
					category: 'validation',
					message: 'Intersection branch outputs conflict.',
					path: [],
					payload: {
						path: ['user', 'id'],
						leftBranch: 0,
						rightBranch: 1,
						leftValue: 1,
						rightValue: 2,
						reason: 'different_values',
					},
				}],
			})
	})

	it('identifies the actual earlier branch that contributed a later conflict', () => {
		const result = v.intersection([
			v.unknown()
				.transform(() => ({ value: 1 })),
			v.unknown()
				.transform(() => ({ other: true })),
			v.unknown()
				.transform(() => ({ value: 2 })),
		])
			.execute(null)
		expect(result)
			.toMatchObject({
				issues: [{
					payload: {
						path: ['value'],
						leftBranch: 0,
						rightBranch: 2,
						leftValue: 1,
						rightValue: 2,
						reason: 'different_values',
					},
				}],
			})
	})

	it('does not re-run accessors while locating the conflicting branch', () => {
		const read = vi.fn(() => 1)
		const left = Object.defineProperty({}, 'value', {
			enumerable: true,
			get: read,
		})
		const result = v.intersection([
			v.unknown()
				.transform(() => left),
			v.unknown()
				.transform(() => ({ other: true })),
			v.unknown()
				.transform(() => ({ value: 2 })),
		])
			.execute(null)
		expect(result)
			.toMatchObject({
				issues: [{ payload: { leftBranch: 0, rightBranch: 2, path: ['value'] } }],
			})
		expect(read)
			.toHaveBeenCalledTimes(1)
	})

	it('distinguishes incompatible prototypes from distinct references', () => {
		const left = Object.create(null)
		left.value = 1
		const right = { value: 1 }
		expect(v.intersection([
			v.unknown()
				.transform(() => left),
			v.unknown()
				.transform(() => right),
		])
			.execute(null))
			.toMatchObject({
				issues: [{ payload: { reason: 'incompatible_prototype' } }],
			})
	})
})
