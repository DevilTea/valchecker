import { describe, expect, it } from 'vitest'
import { array, createValchecker, isLengthAtLeast, number, string } from '../..'

const v = createValchecker({ steps: [number, string, array, isLengthAtLeast] })

describe('isLengthAtLeast step plugin', () => {
	it.each([
		[v.string().isLengthAtLeast(3), 'hello'],
		[v.array(v.number()).isLengthAtLeast(2), [1, 2]],
	] as const)('accepts values meeting minimum length', (schema, value) => {
		expect(schema.execute(value as never)).toEqual({ value })
	})

	it('rejects values below minimum length', () => {
		expect(v.string().isLengthAtLeast(3).execute('hi')).toEqual({
			issues: [{
				code: 'isLengthAtLeast:expected_length_at_least',
				category: 'validation',
				message: 'Expected a length of at least 3.',
				path: [],
				payload: { value: 'hi', minimum: 3 },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.string().isLengthAtLeast(3, 'Custom length').execute('')).toMatchObject({
			issues: [{ message: 'Custom length' }],
		})
	})
})
