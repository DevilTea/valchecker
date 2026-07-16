import { describe, expect, it } from 'vitest'
import { createValchecker, looseNumber } from '../..'

const v = createValchecker({ steps: [looseNumber] })

describe('looseNumber step plugin', () => {
	it.each([
		[42, 42],
		[Number.NaN, Number.NaN],
		[Infinity, Infinity],
		['42', 42],
		['-1.5', -1.5],
		['.5', 0.5],
		['1e3', 1000],
		['0x10', 16],
		[' 1 ', 1],
		['   ', 0],
		['\n', 0],
	])('normalizes %p to %p', (input, output) => {
		expect(v.looseNumber().execute(input)).toEqual({ value: output })
	})

	it.each(['', 'NaN', 'Infinity', '-Infinity', 'not-a-number', true, 1n])('rejects %p', (value) => {
		const result = v.looseNumber().execute(value)
		expect(result).toMatchObject({
			issues: [{
				code: 'looseNumber:expected_number',
				message: 'Expected a number or number string.',
				path: [],
				payload: { value },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.looseNumber('Custom loose number').execute('nope')).toMatchObject({
			issues: [{ message: 'Custom loose number' }],
		})
	})
})
