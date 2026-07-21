import { describe, expect, it, vi } from 'vitest'
import { implStepPlugin } from '../../core'
import { createValchecker, map, number, string, toAsync, transform, unknown } from '../..'

const mapFixture = implStepPlugin<any>({
	internalFailure: ({ utils }: any) => {
		utils.addSuccessStep(() => {
			throw new Error('internal failure')
		})
	},
	asyncInternalFailure: ({ utils }: any) => {
		utils.addSuccessStep(async () => {
			throw new Error('async internal failure')
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
	steps: [map, mapFixture, number, string, toAsync, transform, unknown],
})

describe('map step plugin', () => {
	it.each([
		['object', {}],
		['array', []],
		['set', new Set()],
		['null', null],
		['undefined', undefined],
	] as const)('rejects %s input as a non-Map', (_kind, value) => {
		expect(v.map({ key: v.string(), value: v.number() }).execute(value)).toEqual({
			issues: [{
				code: 'map:expected_map',
				category: 'validation',
				message: 'Expected a Map.',
				path: [],
				payload: { value },
			}],
		})
	})

	it('uses the configuration message for its owned classification issue', () => {
		expect(v.map({
			key: v.string(),
			value: v.number(),
			message: 'Map required',
		}).execute({})).toMatchObject({
			issues: [{ code: 'map:expected_map', message: 'Map required' }],
		})
	})

	it('returns transformed keys and values in insertion order without mutating the input', () => {
		const input = new Map<unknown, unknown>([['a', 1], ['b', 2]])
		const schema = v.map({
			key: v.string().transform(value => value.toUpperCase()),
			value: v.number().transform(value => value * 10),
		})

		expect(schema.execute(input)).toEqual({
			value: new Map([['A', 10], ['B', 20]]),
		})
		expect(input).toEqual(new Map([['a', 1], ['b', 2]]))
	})

	it('collects recoverable key and value issues with stable entry paths', () => {
		expect(v.map({ key: v.string(), value: v.number(), collectAllIssues: true })
			.execute(new Map<unknown, unknown>([[1, 'x'], ['ok', 'y']])))
			.toMatchObject({
				issues: [
					{ code: 'string:expected_string', path: [0, 'key'], payload: { value: 1 } },
					{ code: 'number:expected_number', path: [0, 'value'], payload: { value: 'x' } },
					{ code: 'number:expected_number', path: [1, 'value'], payload: { value: 'y' } },
				],
			})
	})

	it('applies the parent message handler to nested child issues', () => {
		const schema = v.map({
			key: v.string(),
			value: v.number(),
			message: issue => `map:${issue.code}`,
			collectAllIssues: true,
		})

		expect(schema.execute(new Map([[1, 'x']]))).toMatchObject({
			issues: [
				{ code: 'string:expected_string', message: 'map:string:expected_string' },
				{ code: 'number:expected_number', message: 'map:number:expected_number' },
			],
		})
	})

	it('rejects transformed key collisions instead of silently overwriting entries', () => {
		const input = new Map([['A', 1], ['a', 2]])
		const schema = v.map({
			key: v.string().transform(value => value.toLowerCase()),
			value: v.number(),
			message: issue => `map:${issue.code}`,
		})

		expect(schema.execute(input)).toEqual({
			issues: [{
				code: 'map:duplicate_transformed_key',
				category: 'validation',
				message: 'map:map:duplicate_transformed_key',
				path: [1, 'key'],
				payload: {
					value: input,
					firstSourceKey: 'A',
					sourceKey: 'a',
					transformedKey: 'a',
					firstIndex: 0,
					index: 1,
				},
			}],
		})
	})

	it('uses SameValueZero when detecting transformed key collisions', () => {
		const schema = v.map({
			key: v.string().transform(value => value === 'first' ? 0 : -0),
			value: v.number(),
		})

		expect(schema.execute(new Map([['first', 1], ['second', 2]]))).toMatchObject({
			issues: [{ code: 'map:duplicate_transformed_key', path: [1, 'key'] }],
		})
	})

	it('preserves fully synchronous collection execution', () => {
		const result = v.map({ key: v.string(), value: v.number() })
			.execute(new Map([['a', 1]]))

		expect(result).not.toBeInstanceOf(Promise)
		expect(result).toEqual({ value: new Map([['a', 1]]) })
	})

	it('continues sequentially after a key first returns a promise', async () => {
		let first = true
		const order: string[] = []
		const key = v.string().transform((value) => {
			order.push(`key:${value}`)
			if (first) {
				first = false
				return Promise.resolve(value.toUpperCase())
			}
			return value.toUpperCase()
		})
		const value = v.number().transform((entryValue) => {
			order.push(`value:${entryValue}`)
			return entryValue
		})

		await expect(v.map({ key, value }).execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toEqual({ value: new Map([['A', 1], ['B', 2]]) })
		expect(order).toEqual(['key:a', 'value:1', 'key:b', 'value:2'])
	})

	it('continues value validation and later entries after an asynchronous recoverable key failure', async () => {
		const observed = vi.fn()
		const key = v.string().transform(async () => {
			throw new Error('recoverable')
		})
		const value = (v as any).number().observe(observed)

		await expect(v.map({ key, value, collectAllIssues: true })
			.execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toMatchObject({
				issues: [
					{ code: 'transform:callback_failed', path: [0, 'key'] },
					{ code: 'transform:callback_failed', path: [1, 'key'] },
				],
			})
		expect(observed).toHaveBeenCalledTimes(2)
	})

	it('stops the current value and later entries after an internal key failure', () => {
		const observed = vi.fn()
		const internal = (v as any).unknown().internalFailure()
		const normal = v.string()
		const key = {
			'~execute': (value: unknown) => value === 'internal'
				? internal['~execute'](value)
				: normal['~execute'](value),
		} as any
		const value = (v as any).number().observe(observed)

		expect((v as any).map({ key, value })
			.execute(new Map([['internal', 1], ['later', 2]])))
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					path: [0, 'key'],
				}],
			})
		expect(observed).not.toHaveBeenCalled()
	})

	it('stops later entries after an asynchronous internal value failure', async () => {
		const observed = vi.fn()
		const internal = (v as any).unknown().asyncInternalFailure()
		const later = (v as any).unknown().observe(observed)
		const value = {
			'~execute': (entryValue: unknown) => entryValue === 'internal'
				? internal['~execute'](entryValue)
				: later['~execute'](entryValue),
		} as any

		await expect((v as any).map({ key: v.string(), value })
			.execute(new Map([['a', 'internal'], ['b', 'later']])))
			.resolves.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					path: [0, 'value'],
				}],
			})
		expect(observed).not.toHaveBeenCalled()
	})

	it('snapshots entries before child execution mutates the input Map', () => {
		const input = new Map([['a', 1]])
		const key = v.string().transform((value) => {
			input.set('later', 2)
			return value
		})

		expect(v.map({ key, value: v.number() }).execute(input)).toEqual({
			value: new Map([['a', 1]]),
		})
	})
})