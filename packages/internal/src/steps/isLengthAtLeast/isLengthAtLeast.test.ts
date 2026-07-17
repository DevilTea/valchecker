import { describe, expect, it } from 'vitest'
import { any, array, createValchecker, isLengthAtLeast, number, string } from '../..'

const v = createValchecker({ steps: [any, number, string, array, isLengthAtLeast] })

describe('isLengthAtLeast step plugin', () => {
	it.each([
		[v.string().isLengthAtLeast(3), 'hello'],
		[v.array(v.number()).isLengthAtLeast(2), [1, 2]],
	] as const)('accepts values meeting minimum length', (schema, value) => {
		expect(schema.execute(value as never)).toEqual({ value })
	})

	it('reports the observed length below the minimum', () => {
		expect(v.string().isLengthAtLeast(3).execute('hi')).toEqual({
			issues: [{
				code: 'isLengthAtLeast:expected_length_at_least',
				category: 'validation',
				message: 'Expected a length of at least 3.',
				path: [],
				payload: { length: 2, value: 'hi', minimum: 3 },
			}],
		})
	})

	it('reads a dynamic length once and snapshots the observed value', () => {
		let reads = 0
		const value = {
			get length() {
				reads++
				return 1
			},
		}

		const result = v.any().isLengthAtLeast(3).execute(value)
		expect(reads).toBe(1)
		expect(v.isFailure(result)).toBe(true)
		if (v.isFailure(result)) {
			const issue = result.issues[0]!
			if (issue.code !== 'isLengthAtLeast:expected_length_at_least')
				throw new Error(`Unexpected issue: ${issue.code}`)
			expect(issue.payload).toMatchObject({ minimum: 3, length: 1 })
			expect(issue.payload.value).toBe(value)
		}
		expect(reads).toBe(1)
	})

	it('supports custom messages', () => {
		expect(v.string().isLengthAtLeast(3, 'Custom length').execute('')).toMatchObject({
			issues: [{ message: 'Custom length' }],
		})
	})
})
