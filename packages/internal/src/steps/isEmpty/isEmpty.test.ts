import { describe, expect, it } from 'vitest'
import { array, createValchecker, isEmpty, map, number, set, string } from '../..'

const v = createValchecker({ steps: [string, number, array, map, set, isEmpty] })

describe('isEmpty step plugin', () => {
	it.each([
		[v.string().isEmpty(), ''],
		[v.array(v.number()).isEmpty(), []],
		[v.set(v.string()).isEmpty(), new Set()],
		[v.map({ key: v.string(), value: v.number() }).isEmpty(), new Map()],
	] as const)('accepts empty length- and size-bearing values', (schema, value) => {
		expect(schema.execute(value as never)).toEqual({ value })
	})

	it('preserves the length payload for length-bearing values', () => {
		expect(v.string().isEmpty().execute('x')).toEqual({
			issues: [{
				code: 'isEmpty:expected_empty',
				category: 'validation',
				message: 'Expected an empty value.',
				path: [],
				payload: { length: 1, value: 'x' },
			}],
		})
	})

	it('uses the size payload for size-bearing values', () => {
		const value = new Set(['x'])
		expect(v.set(v.string()).isEmpty().execute(value)).toEqual({
			issues: [{
				code: 'isEmpty:expected_empty',
				category: 'validation',
				message: 'Expected an empty value.',
				path: [],
				payload: { size: 1, value },
			}],
		})
	})

	it('supports custom messages for both payload variants', () => {
		expect(v.string().isEmpty({ message: issue => `length:${'length' in issue.payload}` }).execute('x'))
			.toMatchObject({ issues: [{ message: 'length:true' }] })
		expect(v.set(v.string()).isEmpty({ message: issue => `size:${'size' in issue.payload}` }).execute(new Set(['x'])))
			.toMatchObject({ issues: [{ message: 'size:true' }] })
	})
})
