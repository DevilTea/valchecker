import { describe, expect, it } from 'vitest'
import { array, createValchecker, isNotEmpty, map, number, set, string } from '../..'

const v = createValchecker({ steps: [string, number, array, map, set, isNotEmpty] })

describe('isNotEmpty step plugin', () => {
	it.each([
		[v.string().isNotEmpty(), 'value'],
		[v.array(v.number()).isNotEmpty(), [1]],
		[v.set(v.string()).isNotEmpty(), new Set(['value'])],
		[v.map({ key: v.string(), value: v.number() }).isNotEmpty(), new Map([['value', 1]])],
	] as const)('accepts non-empty length- and size-bearing values', (schema, value) => {
		expect(schema.execute(value as never)).toEqual({ value })
	})

	it('preserves the length payload for length-bearing values', () => {
		expect(v.string().isNotEmpty().execute('')).toEqual({
			issues: [{
				code: 'isNotEmpty:expected_not_empty',
				category: 'validation',
				message: 'Expected a non-empty value.',
				path: [],
				payload: { length: 0, value: '' },
			}],
		})
	})

	it('uses the size payload for size-bearing values', () => {
		const value = new Map()
		expect(v.map({ key: v.string(), value: v.number() }).isNotEmpty().execute(value)).toEqual({
			issues: [{
				code: 'isNotEmpty:expected_not_empty',
				category: 'validation',
				message: 'Expected a non-empty value.',
				path: [],
				payload: { size: 0, value },
			}],
		})
	})

	it('supports custom messages for size-bearing values', () => {
		expect(v.set(v.string()).isNotEmpty({ message: 'Custom non-empty' }).execute(new Set()))
			.toMatchObject({ issues: [{ message: 'Custom non-empty' }] })
	})
})
