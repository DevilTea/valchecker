import { describe, expect, it } from 'vitest'
import { createValchecker, map, number, string, transform } from '../..'

const v = createValchecker({
	steps: [map, number, string, transform],
})

describe('map asynchronous value continuation', () => {
	it('continues entries sequentially after a value first returns a promise', async () => {
		let first = true
		const order: string[] = []
		const value = v.number().transform((entryValue) => {
			order.push(`value:${entryValue}`)
			if (first) {
				first = false
				return Promise.resolve(entryValue * 10)
			}
			return entryValue * 10
		})
		const key = v.string().transform((entryKey) => {
			order.push(`key:${entryKey}`)
			return entryKey.toUpperCase()
		})

		await expect(v.map({ key, value }).execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toEqual({ value: new Map([['A', 10], ['B', 20]]) })
		expect(order).toEqual(['key:a', 'value:1', 'key:b', 'value:2'])
	})

	it('does not append a synchronous key failure again when the value starts async continuation', async () => {
		const value = v.number().transform(entryValue => Promise.resolve(entryValue))

		await expect(v.map({ key: v.number(), value }).execute(new Map<unknown, number>([['bad', 1]])))
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
})
