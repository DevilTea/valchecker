import { describe, expect, it, vi } from 'vitest'
import { createValchecker, number, object, string, transform, unknown } from '../..'
import { structuralFixture } from '../../test-utils/fixtures'

const internalFixture = structuralFixture

const v = createValchecker({
	steps: [internalFixture, number, object, string, transform, unknown],
})

describe('object step plugin', () => {
	it.each([
		['string', 'not an object'],
		['number', 42],
		['null', null],
		['undefined', undefined],
		['array', []],
	] as const)('rejects %s input as a non-object', (_kind, value) => {
		expect(v.object({})
			.execute(value))
			.toEqual({
				issues: [{
					code: 'object:expected_object',
					category: 'validation',
					message: 'Expected an object.',
					path: [],
					payload: { value },
				}],
			})
	})

	it('supports a custom message for its owned object-classification issue', () => {
		expect(v.object({}, { message: 'Custom object' })
			.execute('wrong'))
			.toMatchObject({
				issues: [{
					code: 'object:expected_object',
					message: 'Custom object',
				}],
			})
	})

	it('validates declared fields and strips extra keys', () => {
		expect(v.object({
			name: v.string(),
			age: v.number(),
		})
			.execute({
				name: 'Ada',
				age: 37,
				extra: true,
			}))
			.toEqual({
				value: {
					name: 'Ada',
					age: 37,
				},
			})
	})

	it('materializes missing optional fields as undefined', () => {
		expect(v.object({
			name: v.string(),
			age: [v.number()],
		})
			.execute({ name: 'Ada' }))
			.toEqual({
				value: {
					name: 'Ada',
					age: undefined,
				},
			})
	})

	it('reports the complete missing-key issue contract', () => {
		expect(v.object({
			name: v.string(),
			age: v.number(),
		})
			.execute({ name: 'Ada' }))
			.toEqual({
				issues: [{
					code: 'object:missing_key',
					category: 'validation',
					message: 'Missing required object key.',
					path: ['age'],
					payload: { key: 'age' },
				}],
			})
	})

	it('validates an own undefined value instead of treating the key as missing', () => {
		expect(v.object({ value: v.string() })
			.execute({ value: undefined }))
			.toEqual({
				issues: [{
					code: 'string:expected_string',
					category: 'validation',
					message: 'Expected a string.',
					path: ['value'],
					payload: { value: undefined },
				}],
			})
	})

	it('collects child and missing-key issues in struct order', () => {
		expect(v.object({
			name: v.string(),
			age: v.number(),
			city: v.string(),
		}, { collectAllIssues: true })
			.execute({
				name: 123,
				age: 'old',
			}))
			.toEqual({
				issues: [
					{
						code: 'string:expected_string',
						category: 'validation',
						message: 'Expected a string.',
						path: ['name'],
						payload: { value: 123 },
					},
					{
						code: 'number:expected_number',
						category: 'validation',
						message: 'Expected a number.',
						path: ['age'],
						payload: { value: 'old' },
					},
					{
						code: 'object:missing_key',
						category: 'validation',
						message: 'Missing required object key.',
						path: ['city'],
						payload: { key: 'city' },
					},
				],
			})
	})

	it('prepends every nested structural key to child issue paths', () => {
		expect(v.object({
			profile: v.object({
				contact: v.object({ email: v.string() }),
			}),
		})
			.execute({
				profile: {
					contact: { email: 42 },
				},
			}))
			.toMatchObject({
				issues: [{
					code: 'string:expected_string',
					path: ['profile', 'contact', 'email'],
					payload: { value: 42 },
				}],
			})
	})

	it('continues remaining fields after a recoverable asynchronous child failure', async () => {
		const later = vi.fn((value: string) => value.toUpperCase())
		const schema = v.object({
			first: v.string()
				.transform(async () => {
					throw new Error('recoverable')
				}),
			second: v.string()
				.transform(later),
			optional: [v.number()],
		}, { collectAllIssues: true })

		await expect(schema.execute({
			first: 'first',
			second: 'second',
		})).resolves.toMatchObject({
			issues: [{
				code: 'transform:callback_failed',
				category: 'operation',
				path: ['first'],
				payload: { phase: 'reject', value: 'first' },
			}],
		})
		expect(later)
			.toHaveBeenCalledOnce()
	})

	it('continues a mixed pipeline after the first child becomes asynchronous', async () => {
		const schema = v.object({
			name: v.string()
				.transform(async value => value.toUpperCase()),
			age: v.number(),
			city: v.string(),
		})

		await expect(schema.execute({
			name: 'ada',
			age: 37,
			city: 'Taipei',
		})).resolves.toEqual({
			value: {
				name: 'ADA',
				age: 37,
				city: 'Taipei',
			},
		})
	})

	it('stops synchronous field evaluation after an internal child failure', () => {
		const later = vi.fn()
		const schema = (v as any).object({
			invalid: v.number(),
			internal: (v as any).unknown()
				.internalFailure(),
			later: (v as any).unknown()
				.observe(later),
		}, { collectAllIssues: true })
		const result = schema.execute({
			invalid: 'wrong',
			internal: 'value',
			later: 'not reached',
		})

		expect(result)
			.toMatchObject({
				issues: [
					{ code: 'number:expected_number', path: ['invalid'] },
					{
						code: 'core:unknown_exception',
						category: 'internal',
						path: ['internal'],
						payload: { method: 'internalFailure' },
					},
				],
			})
		expect(later).not.toHaveBeenCalled()
	})

	it('stops asynchronous field evaluation after an internal child failure', async () => {
		const later = vi.fn()
		const schema = (v as any).object({
			internal: (v as any).unknown()
				.asyncInternalFailure(),
			later: (v as any).unknown()
				.observe(later),
		})

		await expect(schema.execute({
			internal: 'value',
			later: 'not reached',
		})).resolves.toMatchObject({
			issues: [{
				code: 'core:unknown_exception',
				category: 'internal',
				path: ['internal'],
				payload: { method: 'asyncInternalFailure' },
			}],
		})
		expect(later).not.toHaveBeenCalled()
	})
})
