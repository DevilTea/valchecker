import { describe, expect, it } from 'vitest'
import { any, createValchecker, isSizeAtLeast, map, number, set, string } from '../..'

const v = createValchecker({ steps: [any, isSizeAtLeast, map, number, set, string] })

describe('isSizeAtLeast step plugin', () => {
	it.each([
		['exactly the inclusive minimum', new Set(['a', 'b']), 2],
		['above the minimum', new Set(['a', 'b', 'c']), 2],
		['a zero minimum met by an empty collection', new Set<string>(), 0],
	])('preserves a value whose size is %s', (_label, value, minimumSize) => {
		expect(v.set(v.string())
			.isSizeAtLeast(minimumSize)
			.execute(value))
			.toEqual({ value })
	})

	it('reports the observed size, the configured minimum, and the interpolated default message', () => {
		const value = new Map([['a', 1]])
		expect(v.map({ key: v.string(), value: v.number() })
			.isSizeAtLeast(2)
			.execute(value))
			.toEqual({
				issues: [{
					code: 'isSizeAtLeast:expected_size_at_least',
					category: 'validation',
					message: 'Expected a size of at least 2.',
					path: [],
					payload: { value, minimumSize: 2, size: 1 },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.set(v.string())
			.isSizeAtLeast(2, { message: 'Too small' })
			.execute(new Set(['a'])))
			.toMatchObject({ issues: [{ message: 'Too small' }] })
	})

	it('reads a dynamic size once and snapshots the observed value', () => {
		let reads = 0
		const value = {
			get size() {
				reads++
				return 1
			},
		}

		const result = v.any()
			.isSizeAtLeast(3)
			.execute(value)
		expect(reads)
			.toBe(1)
		expect(result)
			.toMatchObject({ issues: [{ payload: { minimumSize: 3, size: 1 } }] })
	})

	it('does not add an undocumented non-negative policy', () => {
		expect(v.set(v.string())
			.isSizeAtLeast(-1)
			.execute(new Set()))
			.toEqual({ value: new Set() })
	})
})
