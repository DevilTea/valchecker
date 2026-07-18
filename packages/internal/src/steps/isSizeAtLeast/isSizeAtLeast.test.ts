import { describe, expect, it } from 'vitest'
import { createValchecker, isSizeAtLeast, map, number, set, string } from '../..'

const v = createValchecker({ steps: [isSizeAtLeast, map, number, set, string] })

describe('isSizeAtLeast step plugin', () => {
	it('preserves values whose size meets the configured minimum', () => {
		const value = new Set(['a', 'b'])
		expect(v.set(v.string()).isSizeAtLeast(2).execute(value)).toEqual({ value })
	})

	it('reports the observed size and configured minimum', () => {
		const value = new Map([['a', 1]])
		expect(v.map({ key: v.string(), value: v.number() }).isSizeAtLeast(2, { message: 'Too small' }).execute(value)).toEqual({
			issues: [{
				code: 'isSizeAtLeast:expected_size_at_least',
				category: 'validation',
				message: 'Too small',
				path: [],
				payload: { value, minimumSize: 2, size: 1 },
			}],
		})
	})

	it('does not add an undocumented non-negative policy', () => {
		expect(v.set(v.string()).isSizeAtLeast(-1).execute(new Set())).toEqual({ value: new Set() })
	})
})
