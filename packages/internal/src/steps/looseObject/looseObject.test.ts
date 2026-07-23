import { describe, expect, it } from 'vitest'
import { createValchecker, looseObject, number, string, transform } from '../..'

const v = createValchecker({ steps: [looseObject, number, string, transform] })

describe('looseObject step plugin', () => {
	it.each([
		['string', 'not an object'],
		['number', 42],
		['array', []],
		['null', null],
		['undefined', undefined],
	] as const)('rejects %s input as a non-object', (_kind, value) => {
		expect(v.looseObject({})
			.execute(value))
			.toEqual({
				issues: [{
					code: 'looseObject:expected_object',
					category: 'validation',
					message: 'Expected an object.',
					path: [],
					payload: { value },
				}],
			})
	})

	it('preserves extra own properties while replacing declared outputs', () => {
		expect(v.looseObject({
			name: v.string()
				.transform(value => value.toUpperCase()),
			age: v.number(),
		})
			.execute({
				name: 'Ada',
				age: 37,
				extra: true,
			}))
			.toEqual({
				value: {
					name: 'ADA',
					age: 37,
					extra: true,
				},
			})
	})

	it('materializes a missing optional field as undefined', () => {
		expect(v.looseObject({
			name: v.string(),
			age: [v.number()],
		})
			.execute({ name: 'Ada', extra: true }))
			.toEqual({
				value: {
					name: 'Ada',
					age: undefined,
					extra: true,
				},
			})
	})

	it('does not materialize extra descriptors after a declared field fails', () => {
		let ownKeysCalls = 0
		const input = new Proxy({ value: 42, extra: true }, {
			ownKeys(target) {
				ownKeysCalls++
				return Reflect.ownKeys(target)
			},
		})

		expect(v.looseObject({ value: v.string() })
			.execute(input))
			.toMatchObject({
				issues: [{ code: 'string:expected_string' }],
			})
		expect(ownKeysCalls)
			.toBe(0)
	})

	it('reports the complete missing-key issue contract', () => {
		expect(v.looseObject({
			name: v.string(),
			age: v.number(),
		})
			.execute({ name: 'Ada' }))
			.toEqual({
				issues: [{
					code: 'looseObject:missing_key',
					category: 'validation',
					message: 'Missing required object key.',
					path: ['age'],
					payload: { key: 'age' },
				}],
			})
	})

	it('validates an own undefined value instead of treating the key as missing', () => {
		expect(v.looseObject({ value: v.string() })
			.execute({
				value: undefined,
				extra: true,
			}))
			.toMatchObject({
				issues: [{
					code: 'string:expected_string',
					path: ['value'],
					payload: { value: undefined },
				}],
			})
	})

	it('prefixes nested child issue paths', () => {
		expect(v.looseObject({
			profile: v.looseObject({ age: v.number() }),
		})
			.execute({
				profile: { age: 'old', extra: true },
				topLevelExtra: true,
			}))
			.toMatchObject({
				issues: [{
					code: 'number:expected_number',
					path: ['profile', 'age'],
					payload: { value: 'old' },
				}],
			})
	})

	it('continues declared fields after asynchronous work and preserves extras', async () => {
		const schema = v.looseObject({
			value: v.number()
				.transform(async value => value * 2),
			name: v.string(),
			count: v.number(),
		})

		await expect(schema.execute({
			value: 5,
			name: 'test',
			count: 10,
			extra: 'preserved',
		})).resolves.toEqual({
			value: {
				value: 10,
				name: 'test',
				count: 10,
				extra: 'preserved',
			},
		})
	})

	it('continues after a recoverable asynchronous child failure', async () => {
		const schema = v.looseObject({
			first: v.string()
				.transform(async () => { throw new Error('recoverable') }),
			optional: [v.number()],
			last: v.string(),
		})

		await expect(schema.execute({
			first: 'value',
			last: 'still validated',
			extra: true,
		})).resolves.toMatchObject({
			issues: [{
				code: 'transform:callback_failed',
				category: 'operation',
				path: ['first'],
			}],
		})
	})

	it('uses custom messages for owned structural issues', () => {
		expect(v.looseObject({}, { message: 'Custom object' })
			.execute('wrong'))
			.toMatchObject({
				issues: [{ message: 'Custom object' }],
			})
		expect(v.looseObject({ value: v.string() }, { message: 'Custom key' })
			.execute({}))
			.toMatchObject({
				issues: [{
					code: 'looseObject:missing_key',
					message: 'Custom key',
				}],
			})
	})
})
