import { describe, expect, it } from 'vitest'
import { createValchecker, looseBoolean } from '../..'

const v = createValchecker({ steps: [looseBoolean] })

describe('looseBoolean step plugin', () => {
	it.each([
		[true, true],
		[false, false],
		['true', true],
		['false', false],
	])('normalizes %p to %p', (input, output) => {
		expect(v.looseBoolean()
			.execute(input))
			.toEqual({ value: output })
	})

	it.each(['TRUE', 'False', '1', '', 1, null])('rejects %p', (value) => {
		expect(v.looseBoolean()
			.execute(value))
			.toEqual({
				issues: [{
					code: 'looseBoolean:expected_boolean',
					category: 'validation',
					message: 'Expected a boolean or boolean string.',
					path: [],
					payload: { value },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.looseBoolean({ message: 'Custom boolean' })
			.execute('TRUE'))
			.toMatchObject({
				issues: [{ message: 'Custom boolean' }],
			})
	})
})
