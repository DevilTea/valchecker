import { describe, expect, it } from 'vitest'
import { any, createValchecker, isSizeExactly, map, number, set, string } from '../..'

const v = createValchecker({ steps: [any, isSizeExactly, map, number, set, string] })

describe('isSizeExactly step plugin', () => {
	it('preserves values with the configured exact size', () => {
		const value = new Set(['a'])
		expect(v.set(v.string())
			.isSizeExactly(1)
			.execute(value))
			.toEqual({ value })
	})

	it('reports the observed and expected sizes', () => {
		const value = new Map([['a', 1]])
		expect(v.map({ key: v.string(), value: v.number() })
			.isSizeExactly(2, { message: 'Wrong size' })
			.execute(value))
			.toEqual({
				issues: [{
					code: 'isSizeExactly:expected_size_exactly',
					category: 'validation',
					message: 'Wrong size',
					path: [],
					payload: { value, expectedSize: 2, size: 1 },
				}],
			})
	})

	it('rejects a size above the expected size with the interpolated default message', () => {
		const value = new Set(['a', 'b'])
		expect(v.set(v.string())
			.isSizeExactly(1)
			.execute(value))
			.toEqual({
				issues: [{
					code: 'isSizeExactly:expected_size_exactly',
					category: 'validation',
					message: 'Expected a size of exactly 1.',
					path: [],
					payload: { value, expectedSize: 1, size: 2 },
				}],
			})
	})

	it('reads a dynamic size once and snapshots the observed value', () => {
		let reads = 0
		const value = {
			get size() {
				reads++
				return reads === 1 ? 1 : 2
			},
		}

		const result = v.any()
			.isSizeExactly(2)
			.execute(value)
		expect(reads)
			.toBe(1)
		expect(v.isFailure(result))
			.toBe(true)
		if (v.isFailure(result)) {
			const issue = result.issues[0]!
			if (issue.code !== 'isSizeExactly:expected_size_exactly')
				throw new Error(`Unexpected issue: ${issue.code}`)
			expect(issue.payload)
				.toMatchObject({ expectedSize: 2, size: 1 })
			expect(issue.payload.value)
				.toBe(value)
		}
		expect(reads)
			.toBe(1)
	})

	it('uses exact numeric equality without hidden policy', () => {
		expect(v.set(v.string())
			.isSizeExactly(Number.POSITIVE_INFINITY)
			.execute(new Set()))
			.toMatchObject({
				issues: [{
					message: 'Expected a size of exactly Infinity.',
					payload: { expectedSize: Number.POSITIVE_INFINITY, size: 0 },
				}],
			})
	})
})
