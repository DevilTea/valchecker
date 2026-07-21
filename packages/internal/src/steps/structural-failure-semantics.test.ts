import { describe, expect, it, vi } from 'vitest'
import { implStepPlugin } from '../core'
import { array } from './array'
import { createValchecker } from './createValchecker'
import { intersection } from './intersection'
import { looseObject } from './looseObject'
import { number } from './number'
import { object } from './object'
import { strictObject } from './strictObject'
import { string } from './string'
import { transform } from './transform'
import { union } from './union'
import { unknown } from './unknown'

const internalFailurePlugin = implStepPlugin<any>({
	internalFailure: ({ utils }: any) => {
		utils.addSuccessStep(() => {
			throw new Error('child exploded')
		})
	},
	asyncInternalFailure: ({ utils }: any) => {
		utils.addSuccessStep(async () => {
			throw new Error('async child exploded')
		})
	},
	observe: ({ utils, params: [callback] }: any) => {
		utils.addSuccessStep((value: unknown) => {
			callback(value)
			return utils.success(value)
		})
	},
})

const v = createValchecker({
	steps: [
		array,
		internalFailurePlugin,
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

describe('structural requiredness contract', () => {
	it('object reports a missing own key instead of validating synthetic undefined', () => {
		const result = v.object({ value: v.string() })
			.execute({})

		expect(result)
			.toEqual({
				issues: [{
					code: 'object:missing_key',
					category: 'validation',
					message: 'Missing required object key.',
					path: ['value'],
					payload: { key: 'value' },
				}],
			})
	})

	it('object validates an own property whose value is undefined', () => {
		const result = v.object({ value: v.string() })
			.execute({ value: undefined })

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'string:expected_string',
					path: ['value'],
					payload: { value: undefined },
				}],
			})
	})

	it('strictObject reports a missing own key instead of validating synthetic undefined', () => {
		const result = v.strictObject({ value: v.string() })
			.execute({})

		expect(result)
			.toEqual({
				issues: [{
					code: 'strictObject:missing_key',
					category: 'validation',
					message: 'Missing required object key.',
					path: ['value'],
					payload: { key: 'value' },
				}],
			})
	})

	it('strictObject validates an own property whose value is undefined', () => {
		const result = v.strictObject({ value: v.string() })
			.execute({ value: undefined })

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'string:expected_string',
					path: ['value'],
					payload: { value: undefined },
				}],
			})
	})

	it('looseObject reports a missing own key instead of validating synthetic undefined', () => {
		const result = v.looseObject({ value: v.string() })
			.execute({})

		expect(result)
			.toEqual({
				issues: [{
					code: 'looseObject:missing_key',
					category: 'validation',
					message: 'Missing required object key.',
					path: ['value'],
					payload: { key: 'value' },
				}],
			})
	})

	it('looseObject validates an own property whose value is undefined', () => {
		const result = v.looseObject({ value: v.string() })
			.execute({ value: undefined })

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'string:expected_string',
					path: ['value'],
					payload: { value: undefined },
				}],
			})
	})

	it('skips an absent optional child but emits an own undefined output property', () => {
		for (const createSchema of [
			() => v.object({ value: [v.string()] }),
			() => v.strictObject({ value: [v.string()] }),
			() => v.looseObject({ value: [v.string()] }),
		]) {
			const result = createSchema()
				.execute({})
			expect(result)
				.toEqual({ value: { value: undefined } })
			if (v.isSuccess(result))
				expect(Object.hasOwn(result.value as object, 'value')).toBe(true)
		}
	})

	it('does not treat an inherited property as present', () => {
		const input = Object.create({ value: 'inherited' }) as Record<string, unknown>
		for (const createSchema of [
			() => v.object({ value: v.string() }),
			() => v.strictObject({ value: v.string() }),
			() => v.looseObject({ value: v.string() }),
		]) {
			expect(createSchema().execute(input))
				.toMatchObject({ issues: [{ code: expect.stringMatching(/:missing_key$/), path: ['value'] }] })
		}
	})

	it('supports symbol keys and points missing-key paths at the symbol', () => {
		const key = Symbol('value')
		for (const createSchema of [
			() => v.object({ [key]: v.string() }),
			() => v.strictObject({ [key]: v.string() }),
			() => v.looseObject({ [key]: v.string() }),
		]) {
			const missing = createSchema().execute({})
			expect(missing)
				.toMatchObject({ issues: [{ path: [key], payload: { key } }] })
			const success = createSchema().execute({ [key]: 'ok' })
			expect(success)
				.toMatchObject({ value: { [key]: 'ok' } })
		}
	})

	it('continues structural requiredness checks after an asynchronous child', async () => {
		for (const createSchema of [
			() => v.object({ first: v.string().transform(async value => value), missing: v.string() }),
			() => v.strictObject({ first: v.string().transform(async value => value), missing: v.string() }),
			() => v.looseObject({ first: v.string().transform(async value => value), missing: v.string() }),
		]) {
			await expect(createSchema().execute({ first: 'ok' }))
				.resolves.toMatchObject({ issues: [{ code: expect.stringMatching(/:missing_key$/), path: ['missing'] }] })
		}
	})

	it('reads an enumerable own getter once per object execution', () => {
		for (const createSchema of [
			() => v.object({ value: v.string() }),
			() => v.strictObject({ value: v.string() }),
			() => v.looseObject({ value: v.string() }),
		]) {
			let reads = 0
			const input = Object.defineProperty({}, 'value', {
				enumerable: true,
				get() {
					reads++
					return 'ok'
				},
			})
			expect(createSchema().execute(input))
				.toMatchObject({ value: { value: 'ok' } })
			expect(reads).toBe(1)
		}
	})

	it('strictObject aggregates unexpected, missing, and invalid known fields', () => {
		const result = v.strictObject({
			missing: v.string(),
			invalid: v.number(),
		}, { collectAllIssues: true })
			.execute({ invalid: 'bad', extra: true })

		expect(result)
			.toEqual({
				issues: [
					{
						code: 'strictObject:unexpected_keys',
						category: 'validation',
						message: 'Unexpected object keys found.',
						path: [],
						payload: {
							keys: ['extra'],
							expectedKeys: ['missing', 'invalid'],
						},
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

	it('union records branch provenance without changing data paths', () => {
		const result = v.union([
			v.object({ name: v.string() }),
			v.object({ age: v.number() }),
		])
			.execute({ name: 1, age: 'old' })

		expect(result)
			.toMatchObject({
				issues: [
					{ code: 'string:expected_string', path: ['name'], context: [{ type: 'union', branchIndex: 0 }] },
					{ code: 'number:expected_number', path: ['age'], context: [{ type: 'union', branchIndex: 1 }] },
				],
			})
	})

	it('nested unions preserve inner-to-outer provenance and dynamic message metadata', () => {
		const seen: Array<{ path: PropertyKey[], context: unknown }> = []
		const leaf = v.string({ message: ({ path, context }) => {
			seen.push({ path: [...path], context })
			return 'leaf message'
		} })
		const result = v.union([
			v.union([leaf, v.number()]),
			v.object({ value: v.number() }),
		])
			.execute(true)

		expect(result)
			.toMatchObject({
				issues: [
					{
						code: 'string:expected_string',
						message: 'leaf message',
						context: [
							{ type: 'union', branchIndex: 0 },
							{ type: 'union', branchIndex: 0 },
						],
					},
				],
			})
		expect(seen)
			.toEqual([{
				path: [],
				context: [
					{ type: 'union', branchIndex: 0 },
					{ type: 'union', branchIndex: 0 },
				],
			}])
	})

	it('union immediately returns an internal branch failure instead of accepting a later branch', () => {
		const later = vi.fn()
		const result = (v as any).union([
			(v as any).unknown().internalFailure(),
			(v as any).unknown().observe(later),
		])
			.execute('value')

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					path: [],
					payload: { method: 'internalFailure' },
				}],
			})
		expect(later).not.toHaveBeenCalled()
	})

	it('union discards earlier alternative failures when a later branch is internal', () => {
		const result = (v as any).union([
			v.string(),
			(v as any).unknown().internalFailure(),
		])
			.execute(1)

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					context: [{ type: 'union', branchIndex: 1 }],
				}],
			})
		expect((result as any).issues)
			.toHaveLength(1)
	})

	it('object and array stop evaluating siblings/items after an internal issue', () => {
		const objectLater = vi.fn()
		const objectResult = (v as any).object({
			first: (v as any).unknown().internalFailure(),
			later: (v as any).unknown().observe(objectLater),
		})
			.execute({ first: 'value', later: 'value' })
		expect(objectResult)
			.toMatchObject({ issues: [{ category: 'internal', path: ['first'] }] })
		expect(objectLater).not.toHaveBeenCalled()

		const arrayLater = vi.fn()
		const internalItem = (v as any).unknown().internalFailure()
		const observedItem = (v as any).unknown().observe(arrayLater)
		const arrayResult = (v as any).array({
			'~execute': (value: unknown) => value === 'first'
				? internalItem['~execute'](value)
				: observedItem['~execute'](value),
		})
			.execute(['first', 'later'])
		expect(arrayResult)
			.toMatchObject({ issues: [{ category: 'internal', path: [0] }] })
		expect(arrayLater).not.toHaveBeenCalled()
	})

	it('object variants and arrays stop after an asynchronous internal issue', async () => {
		for (const createSchema of [
			(later: ReturnType<typeof vi.fn>) => (v as any).object({
				first: (v as any).unknown().asyncInternalFailure(),
				later: (v as any).unknown().observe(later),
			}),
			(later: ReturnType<typeof vi.fn>) => (v as any).strictObject({
				first: (v as any).unknown().asyncInternalFailure(),
				later: (v as any).unknown().observe(later),
			}),
			(later: ReturnType<typeof vi.fn>) => (v as any).looseObject({
				first: (v as any).unknown().asyncInternalFailure(),
				later: (v as any).unknown().observe(later),
			}),
		]) {
			const later = vi.fn()
			await expect(createSchema(later).execute({ first: 'value', later: 'value' }))
				.resolves.toMatchObject({ issues: [{ category: 'internal', path: ['first'] }] })
			expect(later).not.toHaveBeenCalled()
		}

		const later = vi.fn()
		const internalItem = (v as any).unknown().asyncInternalFailure()
		const observedItem = (v as any).unknown().observe(later)
		await expect((v as any).array({
			'~execute': (value: unknown) => value === 'first'
				? internalItem['~execute'](value)
				: observedItem['~execute'](value),
		}).execute(['first', 'later']))
			.resolves.toMatchObject({ issues: [{ category: 'internal', path: [0] }] })
		expect(later).not.toHaveBeenCalled()
	})

	it('union handles asynchronous recoverable and internal branch failures', async () => {
		const recoverable = v.string().transform(async () => {
			throw new Error('recoverable')
		})
		const success = v.unknown().transform(async value => `ok:${String(value)}`)
		await expect(v.union([recoverable, success]).execute('value'))
			.resolves.toEqual({ value: 'ok:value' })

		const later = vi.fn()
		await expect((v as any).union([
			v.string().transform(async () => { throw new Error('recoverable') }),
			(v as any).unknown().asyncInternalFailure(),
			(v as any).unknown().observe(later),
		]).execute('value'))
			.resolves.toMatchObject({
				issues: [{ category: 'internal', context: [{ type: 'union', branchIndex: 1 }] }],
			})
		expect(later).not.toHaveBeenCalled()
	})

	it('reports the nested conflict path and branch pair', () => {
		const result = v.intersection([
			v.unknown().transform(() => ({ profile: { age: 1 } })),
			v.unknown().transform(() => ({ profile: { age: 2 } })),
		])
			.execute('value')

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'intersection:conflicting_outputs',
					payload: {
						path: ['profile', 'age'],
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
			v.unknown().transform(() => ({ leftOnly: true })),
			v.unknown().transform(() => ({ nested: { value: 'left' } })),
			v.unknown().transform(() => ({ nested: { value: 'right' } })),
		])
			.execute('value')

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'intersection:conflicting_outputs',
					payload: {
						path: ['nested', 'value'],
						leftBranch: 1,
						rightBranch: 2,
					},
				}],
			})
	})

	it('does not re-run accessors while locating the conflicting branch', () => {
		let reads = 0
		const left = Object.defineProperty({}, 'nested', {
			enumerable: true,
			get() {
				reads++
				return { value: 'left' }
			},
		})
		const result = v.intersection([
			v.unknown().transform(() => ({ unrelated: true })),
			v.unknown().transform(() => left),
			v.unknown().transform(() => ({ nested: { value: 'right' } })),
		])
			.execute('value')

		expect(result)
			.toMatchObject({
				issues: [{ payload: { leftBranch: 1, rightBranch: 2 } }],
			})
		expect(reads).toBe(1)
	})

	it('distinguishes incompatible prototypes from distinct references', () => {
		const samePrototype = v.intersection([
			v.unknown().transform(() => new Date(0)),
			v.unknown().transform(() => new Date(0)),
		])
			.execute('value')
		expect(samePrototype)
			.toMatchObject({ issues: [{ payload: { reason: 'different_references' } }] })

		const differentPrototype = v.intersection([
			v.unknown().transform(() => new Date(0)),
			v.unknown().transform(() => /value/),
		])
			.execute('value')
		expect(differentPrototype)
			.toMatchObject({ issues: [{ payload: { reason: 'incompatible_prototype' } }] })
	})
})