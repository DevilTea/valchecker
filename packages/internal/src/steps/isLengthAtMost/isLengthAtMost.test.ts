import { describe, expect, it } from 'vitest'
import { any, array, createValchecker, isLengthAtMost, number, string } from '../..'

const v = createValchecker({ steps: [any, number, string, array, isLengthAtMost] })

describe('isLengthAtMost step plugin', () => {
	it.each([
		[v.string()
			.isLengthAtMost(5), 'hello'],
		[v.string()
			.isLengthAtMost(5), 'hi'],
		[v.array(v.number())
			.isLengthAtMost(2), [1, 2]],
	] as const)('accepts values meeting maximum length', (schema, value) => {
		expect(schema.execute(value as never))
			.toEqual({ value })
	})

	it('rejects values above maximum length', () => {
		expect(v.string()
			.isLengthAtMost(3)
			.execute('hello'))
			.toEqual({
				issues: [{
					code: 'isLengthAtMost:expected_length_at_most',
					category: 'validation',
					message: 'Expected a length of at most 3.',
					path: [],
					payload: { length: 5, value: 'hello', maximumLength: 3 },
				}],
			})
	})

	it('rejects a length one above the maximum', () => {
		expect(v.string()
			.isLengthAtMost(3)
			.execute('abcd'))
			.toMatchObject({
				issues: [{
					code: 'isLengthAtMost:expected_length_at_most',
					payload: { length: 4, maximumLength: 3 },
				}],
			})
	})

	it('reads a dynamic length once and snapshots the observed value', () => {
		let reads = 0
		const value = {
			get length() {
				reads++
				return reads === 1 ? 5 : 0
			},
		}

		const result = v.any()
			.isLengthAtMost(3)
			.execute(value)
		expect(reads)
			.toBe(1)
		expect(v.isFailure(result))
			.toBe(true)
		if (v.isFailure(result)) {
			const issue = result.issues[0]!
			if (issue.code !== 'isLengthAtMost:expected_length_at_most')
				throw new Error(`Unexpected issue: ${issue.code}`)
			expect(issue.payload)
				.toMatchObject({ maximumLength: 3, length: 5 })
			expect(issue.payload.value)
				.toBe(value)
		}
		expect(reads)
			.toBe(1)
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isLengthAtMost(3, { message: 'Custom length' })
			.execute('hello'))
			.toMatchObject({
				issues: [{ message: 'Custom length' }],
			})
	})
})
