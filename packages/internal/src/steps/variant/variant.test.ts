import type { InferIssue, InferOperationMode, InferOutput } from '../../core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { check, createValchecker, literal, number, object, string, transform, variant } from '../..'

const v = createValchecker({
	steps: [check, literal, number, object, string, transform, variant],
})

describe('variant step plugin', () => {
	it('selects one branch and returns its transformed output', () => {
		let circleCalls = 0
		let squareCalls = 0
		const schema = v.variant({
			discriminator: 'type',
			variants: {
				circle: v.object({
					type: v.literal('circle'),
					radius: v.number(),
				}).check(() => {
					circleCalls++
					return true
				}).transform(value => ({ area: Math.PI * value.radius ** 2 })),
				square: v.object({
					type: v.literal('square'),
					size: v.number(),
				}).check(() => {
					squareCalls++
					return true
				}).transform(value => ({ area: value.size ** 2 })),
			},
		})

		expect(schema.execute({ type: 'square', size: 3 })).toEqual({ value: { area: 9 } })
		expect(circleCalls).toBe(0)
		expect(squareCalls).toBe(1)
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<{ area: number }>()
	})

	it.each([
		null,
		[],
		'circle',
		1,
	] as const)('rejects non-object input %j', (input) => {
		expect(v.variant({
			discriminator: 'type',
			variants: { circle: v.object({ type: v.literal('circle') }) },
			message: 'Expected variant object.',
		}).execute(input)).toEqual({
			issues: [{
				code: 'variant:expected_object',
				category: 'validation',
				message: 'Expected variant object.',
				path: [],
				payload: { value: input },
			}],
		})
	})

	it('requires an own matching discriminator and reports its path', () => {
		const schema = v.variant({
			discriminator: 'type',
			variants: {
				circle: v.object({ type: v.literal('circle') }),
				square: v.object({ type: v.literal('square') }),
			},
			message: issue => `${issue.code}:${String(issue.payload.received)}`,
		})
		const inherited = Object.create({ type: 'circle' })

		expect(schema.execute(inherited)).toEqual({
			issues: [{
				code: 'variant:invalid_discriminator',
				category: 'validation',
				message: 'variant:invalid_discriminator:undefined',
				path: ['type'],
				payload: {
					value: inherited,
					discriminator: 'type',
					received: undefined,
					expected: ['circle', 'square'],
				},
			}],
		})
	})

	it('uses JavaScript property-key canonicalization for numeric values', () => {
		const schema = v.variant({
			discriminator: 'kind',
			variants: {
				1: v.object({ kind: v.number(), value: v.string() }),
			},
		})

		expect(schema.execute({ kind: 1, value: 'number' })).toEqual({
			value: { kind: 1, value: 'number' },
		})
		expect(schema.execute({ kind: '1', value: 'string' })).toEqual({
			issues: [{
				code: 'number:expected_number',
				category: 'validation',
				message: 'Expected a number.',
				path: ['kind'],
				context: [{
					type: 'variant',
					discriminator: 'kind',
					discriminatorValue: '1',
				}],
				payload: { value: '1' },
			}],
		})
	})

	it('supports symbol discriminator fields and symbol variant values', () => {
		const discriminator = Symbol('type')
		const selected = Symbol('selected')
		const schema = v.variant({
			discriminator,
			variants: {
				[selected]: v.object({
					[discriminator]: v.literal(selected),
					value: v.number(),
				}),
			},
		})

		expect(schema.execute({ [discriminator]: selected, value: 1 })).toEqual({
			value: { [discriminator]: selected, value: 1 },
		})
	})

	it('preserves child paths, adds variant context, and applies enclosing messages', () => {
		const schema = v.variant({
			discriminator: 'type',
			variants: {
				circle: v.object({
					type: v.literal('circle'),
					radius: v.number(),
				}),
			},
			message: issue => `variant:${issue.code}:${issue.path.join('.')}`,
		})

		expect(schema.execute({ type: 'circle', radius: 'invalid' })).toEqual({
			issues: [{
				code: 'number:expected_number',
				category: 'validation',
				message: 'variant:number:expected_number:radius',
				path: ['radius'],
				context: [{
					type: 'variant',
					discriminator: 'type',
					discriminatorValue: 'circle',
				}],
				payload: { value: 'invalid' },
			}],
		})
	})

	it('keeps originating child messages above the enclosing variant message', () => {
		const schema = v.variant({
			discriminator: 'type',
			variants: {
				circle: v.object({
					type: v.literal('circle'),
					radius: v.number({ message: 'Radius must be numeric.' }),
				}),
			},
			message: 'Invalid selected variant.',
		})

		expect(schema.execute({ type: 'circle', radius: 'invalid' })).toMatchObject({
			issues: [{ message: 'Radius must be numeric.' }],
		})
	})

	it('preserves maybe-async execution and runs only the selected async branch', async () => {
		let syncBranchCalls = 0
		const schema = v.variant({
			discriminator: 'type',
			variants: {
				async: v.object({ type: v.literal('async'), value: v.number() })
					.transform(async value => ({ doubled: value.value * 2 })),
				sync: v.object({ type: v.literal('sync') }).check(() => {
					syncBranchCalls++
					return true
				}),
			},
		})

		const result = schema.execute({ type: 'async', value: 2 })
		expect(result).toBeInstanceOf(Promise)
		await expect(result).resolves.toEqual({ value: { doubled: 4 } })
		expect(syncBranchCalls).toBe(0)
		expectTypeOf<InferOperationMode<typeof schema>>().toEqualTypeOf<'maybe-async'>()
	})

	it('infers owned and selected child issues without widening payload relationships', () => {
		const schema = v.variant({
			discriminator: 'type',
			variants: {
				circle: v.object({ type: v.literal('circle'), radius: v.number() }),
				square: v.object({ type: v.literal('square'), size: v.number() }),
			},
		})
		type Issue = InferIssue<typeof schema>

		expectTypeOf<Extract<Issue, { code: 'variant:invalid_discriminator' }>['payload']>()
			.toEqualTypeOf<{
				value: object
				discriminator: 'type'
				received: unknown
				expected: readonly (string | symbol)[]
			}>()
		expectTypeOf<Extract<Issue, { code: 'number:expected_number' }>['payload']>()
			.toEqualTypeOf<{ value: unknown }>()
	})

	it('rejects invalid JavaScript construction arguments', () => {
		expect(() => (v.variant as any)()).toThrow('configuration object')
		expect(() => (v.variant as any)({ discriminator: true, variants: { a: v.string() } }))
			.toThrow('property key')
		expect(() => (v.variant as any)({ discriminator: 'type', variants: null }))
			.toThrow('variants must be an object')
		expect(() => (v.variant as any)({ discriminator: 'type', variants: {} }))
			.toThrow('at least one variant')
		expect(() => (v.variant as any)({ discriminator: 'type', variants: { a: 1 } }))
			.toThrow('must be a Valchecker schema')
	})

	it('is available only as an initial schema and rejects empty variant maps', () => {
		if (false) {
			// @ts-expect-error variant is an initial schema
			v.string().variant({ discriminator: 'type', variants: { a: v.string() } })
			// @ts-expect-error variants must be non-empty
			v.variant({ discriminator: 'type', variants: {} })
		}
	})
})
