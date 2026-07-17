import { describe, expect, it } from 'vitest'
import { array, createValchecker, isLengthAtMost, number, string } from '../..'

const v = createValchecker({ steps: [number, string, array, isLengthAtMost] })

describe('isLengthAtMost step plugin', () => {
	it.each([
		[v.string().isLengthAtMost(5), 'hello'],
		[v.array(v.number()).isLengthAtMost(2), [1, 2]],
	] as const)('accepts values meeting maximum length', (schema, value) => {
		expect(schema.execute(value as never)).toEqual({ value })
	})

	it('rejects values above maximum length', () => {
		expect(v.string().isLengthAtMost(3).execute('hello')).toEqual({
			issues: [{
				code: 'isLengthAtMost:expected_length_at_most',
				category: 'validation',
				message: 'Expected a length of at most 3.',
				path: [],
				payload: { value: 'hello', maximum: 3 },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.string().isLengthAtMost(3, 'Custom length').execute('hello')).toMatchObject({
			issues: [{ message: 'Custom length' }],
		})
	})
})
