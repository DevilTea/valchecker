import { describe, expect, it } from 'vitest'
import { createValchecker, looseBigint } from '../..'

const v = createValchecker({ steps: [looseBigint] })

describe('looseBigint step plugin', () => {
	it.each([
		[42n, 42n],
		['42', 42n],
		['-42', -42n],
		['-0', 0n],
		['0x10', 16n],
		['-0x10', -16n],
		['0B10', 2n],
		['-0o10', -8n],
	])('normalizes %p to %p', (input, output) => {
		expect(v.looseBigint().execute(input)).toEqual({ value: output })
	})

	it.each(['+1', '01', ' 1 ', '', '1.0', '1e3', '1n', true, 1])('rejects %p', (value) => {
		expect(v.looseBigint().execute(value)).toEqual({
			issues: [{
				code: 'looseBigint:expected_bigint',
				message: 'Expected a bigint or bigint string.',
				path: [],
				payload: { value },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.looseBigint('Custom bigint').execute('01')).toMatchObject({
			issues: [{ message: 'Custom bigint' }],
		})
	})
})