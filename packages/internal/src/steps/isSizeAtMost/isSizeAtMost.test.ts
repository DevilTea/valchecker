import { describe, expect, it } from 'vitest'
import { any, createValchecker, isSizeAtMost, map, number, set, string } from '../..'

const v = createValchecker({ steps: [any, isSizeAtMost, map, number, set, string] })

describe('isSizeAtMost step plugin', () => {
	it.each([
		['exactly the inclusive maximum', new Set(['a', 'b']), 2],
		['below the maximum', new Set(['a']), 2],
		['a zero maximum met by an empty collection', new Set<string>(), 0],
	])('preserves a value whose size is %s', (_label, value, maximumSize) => {
		expect(v.set(v.string())
			.isSizeAtMost(maximumSize)
			.execute(value))
			.toEqual({ value })
	})

	it('reports the observed size, the configured maximum, and the interpolated default message', () => {
		const value = new Set(['a', 'b'])
		expect(v.set(v.string())
			.isSizeAtMost(1)
			.execute(value))
			.toEqual({
				issues: [{
					code: 'isSizeAtMost:expected_size_at_most',
					category: 'validation',
					message: 'Expected a size of at most 1.',
					path: [],
					payload: { value, maximumSize: 1, size: 2 },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.map({ key: v.string(), value: v.number() })
			.isSizeAtMost(0, { message: 'Too large' })
			.execute(new Map([['a', 1]])))
			.toMatchObject({ issues: [{ message: 'Too large' }] })
	})

	it('reads a dynamic size once and snapshots the observed value', () => {
		let reads = 0
		const value = {
			get size() {
				reads++
				return 2
			},
		}

		const result = v.any()
			.isSizeAtMost(1)
			.execute(value)
		expect(reads)
			.toBe(1)
		expect(result)
			.toMatchObject({ issues: [{ payload: { maximumSize: 1, size: 2 } }] })
	})

	it('does not add an undocumented integer policy', () => {
		expect(v.set(v.string())
			.isSizeAtMost(0.5)
			.execute(new Set()))
			.toEqual({ value: new Set() })
	})
})
