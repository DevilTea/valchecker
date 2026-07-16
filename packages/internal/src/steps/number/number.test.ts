import { describe, expect, it } from 'vitest'
import { createValchecker, number } from '../..'

const v = createValchecker({ steps: [number] })

describe('number step plugin', () => {
	it.each([0, -0, 1.5, Number.NaN, Infinity, -Infinity])('accepts JavaScript number %s', (value) => {
		const result = v.number().execute(value)
		expect(result).toEqual({ value })
	})

	it('rejects non-number values', () => {
		expect(v.number().execute('1')).toEqual({
			issues: [{
				code: 'number:expected_number',
				message: 'Expected a number.',
				path: [],
				payload: { value: '1' },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.number(() => 'Custom number message').execute(null)).toEqual({
			issues: [{
				code: 'number:expected_number',
				message: 'Custom number message',
				path: [],
				payload: { value: null },
			}],
		})
	})
})