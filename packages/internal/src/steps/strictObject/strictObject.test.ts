import { describe, expect, it, vi } from 'vitest'
import { createValchecker, number, strictObject, string, transform, unknown } from '../..'
import { structuralFixture } from '../../test-utils/fixtures'

const v = createValchecker({ steps: [number, strictObject, string, transform] })

describe('strictObject step plugin', () => {
	it.each([
		['string', 'not an object'],
		['number', 42],
		['array', []],
		['null', null],
		['undefined', undefined],
	] as const)('rejects %s input as a non-object', (_kind, value) => {
		expect(v.strictObject({})
			.execute(value))
			.toEqual({
				issues: [{
					code: 'strictObject:expected_object',
					category: 'validation',
					message: 'Expected an object.',
					path: [],
					payload: { value },
				}],
			})
	})

	it('returns only declared and validated outputs', () => {
		expect(v.strictObject({
			name: v.string()
				.transform(value => value.toUpperCase()),
			age: v.number(),
		})
			.execute({
				name: 'Ada',
				age: 37,
			}))
			.toEqual({
				value: {
					name: 'ADA',
					age: 37,
				},
			})
	})

	it('materializes a missing optional field as undefined', () => {
		expect(v.strictObject({
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
		expect(v.strictObject({
			name: v.string(),
			age: v.number(),
		})
			.execute({ name: 'Ada' }))
			.toEqual({
				issues: [{
					code: 'strictObject:missing_key',
					category: 'validation',
					message: 'Missing required object key.',
					path: ['age'],
					payload: { key: 'age' },
				}],
			})
	})

	it('reports unexpected keys and the declared key set', () => {
		expect(v.strictObject({
			name: v.string(),
		})
			.execute({
				name: 'Ada',
				extra: true,
				another: 1,
			}))
			.toEqual({
				issues: [{
					code: 'strictObject:unexpected_keys',
					category: 'validation',
					message: 'Unexpected object keys found.',
					path: [],
					payload: {
						keys: ['extra', 'another'],
						expectedKeys: ['name'],
					},
				}],
			})
	})

	it('validates an own undefined value instead of treating the key as missing', () => {
		expect(v.strictObject({ value: v.string() })
			.execute({ value: undefined }))
			.toMatchObject({
				issues: [{
					code: 'string:expected_string',
					path: ['value'],
					payload: { value: undefined },
				}],
			})
	})

	it('collects unexpected, child, and missing-key issues in stable order', () => {
		expect(v.strictObject({
			name: v.string(),
			age: v.number(),
			city: v.string(),
		}, { collectAllIssues: true })
			.execute({
				name: 123,
				age: 'old',
				extra: true,
			}))
			.toEqual({
				issues: [
					{
						code: 'strictObject:unexpected_keys',
						category: 'validation',
						message: 'Unexpected object keys found.',
						path: [],
						payload: {
							keys: ['extra'],
							expectedKeys: ['name', 'age', 'city'],
						},
					},
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
						code: 'strictObject:missing_key',
						category: 'validation',
						message: 'Missing required object key.',
						path: ['city'],
						payload: { key: 'city' },
					},
				],
			})
	})

	it('continues declared fields after the first asynchronous child', async () => {
		const schema = v.strictObject({
			value: v.number()
				.transform(async value => value * 2),
			name: v.string(),
			count: v.number(),
		})

		await expect(schema.execute({
			value: 5,
			name: 'test',
			count: 10,
		})).resolves.toEqual({
			value: {
				value: 10,
				name: 'test',
				count: 10,
			},
		})
	})

	it('continues after a recoverable asynchronous child failure', async () => {
		const schema = v.strictObject({
			first: v.string()
				.transform(async () => { throw new Error('recoverable') }),
			optional: [v.number()],
			last: v.string(),
		}, { collectAllIssues: true })

		await expect(schema.execute({
			first: 'value',
			last: 'still validated',
		})).resolves.toMatchObject({
			issues: [{
				code: 'transform:callback_failed',
				category: 'operation',
				path: ['first'],
			}],
		})
	})

	it('uses custom messages for each owned structural issue', () => {
		const message = (issue: { code: string }) => `Custom: ${issue.code}`
		const options = { message: message as any }

		expect(v.strictObject({}, options)
			.execute('wrong'))
			.toMatchObject({
				issues: [{ message: 'Custom: strictObject:expected_object' }],
			})
		expect(v.strictObject({ value: v.string() }, options)
			.execute({}))
			.toMatchObject({
				issues: [{ message: 'Custom: strictObject:missing_key' }],
			})
		expect(v.strictObject({ value: v.string() }, options)
			.execute({ value: 'ok', extra: true }))
			.toMatchObject({
				issues: [{ message: 'Custom: strictObject:unexpected_keys' }],
			})
	})
})

describe('strictObject asynchronous missing-key contracts', () => {
	it('materializes a missing optional key after an earlier child becomes asynchronous', async () => {
		const schema = v.strictObject({
			first: v.string()
				.transform(async value => value.toUpperCase()),
			optional: [v.number()],
			last: v.string(),
		})

		await expect(schema.execute({
			first: 'ada',
			last: 'present',
		})).resolves.toEqual({
			value: {
				first: 'ADA',
				optional: undefined,
				last: 'present',
			},
		})
	})

	it('reports a missing required key after an earlier child becomes asynchronous', async () => {
		const schema = v.strictObject({
			first: v.string()
				.transform(async value => value.toUpperCase()),
			required: v.number(),
			last: v.string(),
		})

		await expect(schema.execute({
			first: 'ada',
			last: 'still validated',
		})).resolves.toEqual({
			issues: [{
				code: 'strictObject:missing_key',
				category: 'validation',
				message: 'Missing required object key.',
				path: ['required'],
				payload: { key: 'required' },
			}],
		})
	})
})

describe('strictObject collectAllIssues', () => {
	const fixture = structuralFixture

	const v = createValchecker({ steps: [fixture, number, strictObject, string, transform, unknown] })

	it('retains object classification before key validation', () => {
		expect(v.strictObject({}, { collectAllIssues: true })
			.execute(null))
			.toMatchObject({ issues: [{ code: 'strictObject:expected_object' }] })
	})

	it('materializes optional and safe __proto__ fields', () => {
		const ignored = Symbol('ignored')
		const shape: Record<PropertyKey, any> = {
			required: v.string(),
			optional: [v.number()],
		}
		Object.defineProperty(shape, '__proto__', { enumerable: true, value: v.string() })
		Object.defineProperty(shape, ignored, { enumerable: false, value: v.string() })
		const input: Record<PropertyKey, unknown> = { required: 'ok' }
		Object.defineProperty(input, '__proto__', { enumerable: true, value: 'safe' })

		const result = v.strictObject(shape, { collectAllIssues: true })
			.execute(input)
		expect(result)
			.toMatchObject({ value: { required: 'ok', optional: undefined } })
		expect(Object.hasOwn((result as any).value, '__proto__'))
			.toBe(true)
		// eslint-disable-next-line no-proto, no-restricted-properties -- asserting an own __proto__ data property survives as plain data; reading it via the accessor is the behavior under test
		expect((result as any).value.__proto__)
			.toBe('safe')
	})

	it('collects unexpected, missing, and invalid fields before an internal issue', () => {
		const later = vi.fn()
		const result = (v as any).strictObject({
			missing: v.string(),
			invalid: v.number(),
			internal: (v as any).unknown()
				.internalFailure(),
			later: (v as any).unknown()
				.observe(later),
		}, { collectAllIssues: true })
			.execute({
				invalid: 'bad',
				internal: 'value',
				later: 'later',
				extra: true,
			})

		expect(result)
			.toMatchObject({ issues: [
				{ code: 'strictObject:unexpected_keys' },
				{ code: 'strictObject:missing_key', path: ['missing'] },
				{ code: 'number:expected_number', path: ['invalid'] },
				{ code: 'core:unknown_exception', path: ['internal'] },
			] })
		expect(later).not.toHaveBeenCalled()
	})

	it('continues after an asynchronous recoverable issue and stops after an internal issue', async () => {
		await expect(v.strictObject({
			first: v.string()
				.transform(async () => {
					throw new Error('recoverable')
				}),
			optional: [v.number()],
			last: v.string()
				.transform(value => value.toUpperCase()),
			missing: v.string(),
		}, { collectAllIssues: true })
			.execute({ first: 'bad', last: 'ok' }))
			.resolves.toMatchObject({ issues: [
				{ code: 'transform:callback_failed', path: ['first'] },
				{ code: 'strictObject:missing_key', path: ['missing'] },
			] })

		const later = vi.fn()
		await expect((v as any).strictObject({
			first: (v as any).unknown()
				.asyncInternalFailure(),
			later: (v as any).unknown()
				.observe(later),
		}, { collectAllIssues: true })
			.execute({ first: 'bad', later: 'later' }))
			.resolves.toMatchObject({ issues: [{ code: 'core:unknown_exception', path: ['first'] }] })
		expect(later).not.toHaveBeenCalled()
	})
})
