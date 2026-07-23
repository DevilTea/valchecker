import { describe, expect, it } from 'vitest'
import { createValchecker, map, number, string, transform } from '../..'

const v = createValchecker({
	steps: [map, number, string, transform],
})

describe('map asynchronous value continuation', () => {
	it('continues entries sequentially after a value first returns a promise', async () => {
		let first = true
		const order: string[] = []
		const value = v.number()
			.transform((entryValue) => {
				order.push(`value:${entryValue}`)
				if (first) {
					first = false
					return Promise.resolve(entryValue * 10)
				}
				return entryValue * 10
			})
		const key = v.string()
			.transform((entryKey) => {
				order.push(`key:${entryKey}`)
				return entryKey.toUpperCase()
			})

		await expect(v.map({ key, value })
			.execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toEqual({ value: new Map([['A', 10], ['B', 20]]) })
		expect(order)
			.toEqual(['key:a', 'value:1', 'key:b', 'value:2'])
	})

	it('does not append a synchronous key failure again when the value starts async continuation', async () => {
		const value = v.number()
			.transform(entryValue => Promise.resolve(entryValue))

		await expect(v.map({ key: v.number(), value, collectAllIssues: true })
			.execute(new Map<unknown, number>([['bad', 1]])))
			.resolves.toEqual({
				issues: [{
					code: 'number:expected_number',
					category: 'validation',
					message: 'Expected a number.',
					path: [0, 'key'],
					payload: { value: 'bad' },
				}],
			})
	})

	it('reports a transformed-key collision found while continuing asynchronously', async () => {
		const key = v.string()
			.transform(entryKey => Promise.resolve(entryKey === 'b' ? 'a' : entryKey))

		await expect(v.map({ key, value: v.number() })
			.execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toMatchObject({
				issues: [{ code: 'map:duplicate_transformed_key', path: [1, 'key'], payload: { firstSourceKey: 'a', sourceKey: 'b', transformedKey: 'a' } }],
			})
	})

	it('reports a collision on the entry whose key resolves asynchronously', async () => {
		const key = v.string()
			.transform(entryKey => entryKey === 'b' ? Promise.resolve('a') : entryKey)

		await expect(v.map({ key, value: v.number() })
			.execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toMatchObject({
				issues: [{ code: 'map:duplicate_transformed_key', path: [1, 'key'], payload: { firstSourceKey: 'a', sourceKey: 'b', transformedKey: 'a' } }],
			})
	})

	it('stops at a recoverable key failure in a later asynchronous entry', async () => {
		const key = v.string()
			.transform(entryKey => Promise.resolve(entryKey))

		await expect(v.map({ key, value: v.number() })
			.execute(new Map<unknown, unknown>([['a', 1], [2, 3]])))
			.resolves.toMatchObject({ issues: [{ code: 'string:expected_string', path: [1, 'key'] }] })
	})

	it('stops at a recoverable value failure in a later asynchronous entry', async () => {
		const key = v.string()
			.transform(entryKey => Promise.resolve(entryKey))

		await expect(v.map({ key, value: v.number() })
			.execute(new Map<unknown, unknown>([['a', 1], ['b', 'x']])))
			.resolves.toMatchObject({ issues: [{ code: 'number:expected_number', path: [1, 'value'] }] })
	})
})
