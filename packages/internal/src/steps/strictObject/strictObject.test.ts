import { describe, expect, it } from 'vitest'
import { createValchecker, number, strictObject, string, transform } from '../..'

const v = createValchecker({ steps: [number, strictObject, string, transform] })

describe('strictObject step plugin', () => {
	it.each([
		['string', 'not an object'],
		['number', 42],
		['array', []],
		['null', null],
		['undefined', undefined],
	] as const)('rejects %s input as a non-object', (_kind, value) => {
		expect(v.strictObject({}).execute(value)).toEqual({
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
			name: v.string().transform(value => value.toUpperCase()),
			age: v.number(),
		}).execute({
			name: 'Ada',
			age: 37,
		})).toEqual({
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
		}).execute({ name: 'Ada' })).toEqual({
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
		}).execute({ name: 'Ada' })).toEqual({
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
		}).execute({
			name: 'Ada',
			extra: true,
			another: 1,
		})).toEqual({
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
		expect(v.strictObject({ value: v.string() }).execute({ value: undefined }))
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
		}, { collectAllIssues: true }).execute({
			name: 123,
			age: 'old',
			extra: true,
		})).toEqual({
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
			value: v.number().transform(async value => value * 2),
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
			first: v.string().transform(async () => { throw new Error('recoverable') }),
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

		expect(v.strictObject({}, options).execute('wrong')).toMatchObject({
			issues: [{ message: 'Custom: strictObject:expected_object' }],
		})
		expect(v.strictObject({ value: v.string() }, options).execute({})).toMatchObject({
			issues: [{ message: 'Custom: strictObject:missing_key' }],
		})
		expect(v.strictObject({ value: v.string() }, options)
			.execute({ value: 'ok', extra: true })).toMatchObject({
			issues: [{ message: 'Custom: strictObject:unexpected_keys' }],
		})
	})
})