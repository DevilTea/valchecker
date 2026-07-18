import { describe, expect, it } from 'vitest'
import { createValchecker, isSizeAtMost, map, number, set, string } from '../..'

const v = createValchecker({ steps: [isSizeAtMost, map, number, set, string] })

describe('isSizeAtMost step plugin', () => {
	it('preserves values whose size does not exceed the configured maximum', () => {
		const value = new Map([['a', 1]])
		expect(v.map({ key: v.string(), value: v.number() }).isSizeAtMost(1).execute(value)).toEqual({ value })
	})

	it('reports the observed size and configured maximum', () => {
		const value = new Set(['a', 'b'])
		expect(v.set(v.string()).isSizeAtMost(1, { message: 'Too large' }).execute(value)).toEqual({
			issues: [{
				code: 'isSizeAtMost:expected_size_at_most',
				category: 'validation',
				message: 'Too large',
				path: [],
				payload: { value, maximumSize: 1, size: 2 },
			}],
		})
	})

	it('does not add an undocumented integer policy', () => {
		expect(v.set(v.string()).isSizeAtMost(0.5).execute(new Set())).toEqual({ value: new Set() })
	})
})
