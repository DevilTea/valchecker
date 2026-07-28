import { describe, expect, it, vi } from 'vitest'
import { createValchecker, looseObject, number, string, transform, unknown } from '../..'
import { structuralFixture } from '../../test-utils/fixtures'

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

	it('passes an unknown key named "undefined" through unchanged', () => {
		// The output carries the value's own properties minus the declared ones,
		// plus the declared outputs — and nothing else. A key named `'undefined'`
		// is an ordinary own property on both sides of that split.
		expect(v.looseObject({ name: v.string() })
			.execute({ name: 'Ada', undefined: 1 }))
			.toEqual({
				value: {
					name: 'Ada',
					undefined: 1,
				},
			})
	})

	it('validates a declared key named "undefined" exactly once', () => {
		expect(v.looseObject({ undefined: v.string() }, { collectAllIssues: true })
			.execute({ undefined: 1 }))
			.toEqual({
				issues: [{
					code: 'string:expected_string',
					category: 'validation',
					message: 'Expected a string.',
					path: ['undefined'],
					payload: { value: 1 },
				}],
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

describe('looseObject collectAllIssues', () => {
	const fixture = structuralFixture

	const v = createValchecker({ steps: [fixture, looseObject, number, string, transform, unknown] })

	it('retains object classification before field traversal', () => {
		expect(v.looseObject({}, { collectAllIssues: true })
			.execute([]))
			.toMatchObject({ issues: [{ code: 'looseObject:expected_object' }] })
	})

	it('preserves extras while materializing optional and safe __proto__ fields', () => {
		const ignored = Symbol('ignored')
		const shape: Record<PropertyKey, any> = {
			required: v.string(),
			optional: [v.number()],
		}
		Object.defineProperty(shape, '__proto__', { enumerable: true, value: v.string() })
		Object.defineProperty(shape, ignored, { enumerable: false, value: v.string() })
		const input: Record<PropertyKey, unknown> = { required: 'ok', extra: true }
		Object.defineProperty(input, '__proto__', { enumerable: true, value: 'safe' })

		const result = v.looseObject(shape, { collectAllIssues: true })
			.execute(input)
		expect(result)
			.toMatchObject({ value: { required: 'ok', optional: undefined, extra: true } })
		expect(Object.hasOwn((result as any).value, '__proto__'))
			.toBe(true)
		// eslint-disable-next-line no-proto, no-restricted-properties -- asserting an own __proto__ data property survives as plain data; reading it via the accessor is the behavior under test
		expect((result as any).value.__proto__)
			.toBe('safe')
	})

	it('collects missing and invalid fields before a synchronous internal issue', () => {
		const later = vi.fn()
		const result = (v as any).looseObject({
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
				{ code: 'looseObject:missing_key', path: ['missing'] },
				{ code: 'number:expected_number', path: ['invalid'] },
				{ code: 'core:unknown_exception', path: ['internal'] },
			] })
		expect(later).not.toHaveBeenCalled()
	})

	it('continues after an asynchronous recoverable issue and stops after an internal issue', async () => {
		await expect(v.looseObject({
			first: v.string()
				.transform(async () => {
					throw new Error('recoverable')
				}),
			optional: [v.number()],
			last: v.string()
				.transform(value => value.toUpperCase()),
			missing: v.string(),
		}, { collectAllIssues: true })
			.execute({ first: 'bad', last: 'ok', extra: true }))
			.resolves.toMatchObject({ issues: [
				{ code: 'transform:callback_failed', path: ['first'] },
				{ code: 'looseObject:missing_key', path: ['missing'] },
			] })

		const later = vi.fn()
		await expect((v as any).looseObject({
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
