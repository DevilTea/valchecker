import { describe, expect, it } from 'vitest'
import { createValchecker, string, toSplit } from '../..'

const v = createValchecker({ steps: [string, toSplit] })

describe('toSplit step plugin', () => {
	it('splits with a string separator', () => {
		expect(v.string()
			.toSplit(',')
			.execute('a,b,c'))
			.toEqual({ value: ['a', 'b', 'c'] })
	})

	it('forwards the limit parameter', () => {
		expect(v.string()
			.toSplit(',', 2)
			.execute('a,b,c'))
			.toEqual({ value: ['a', 'b'] })
	})

	it('supports regular expression separators', () => {
		expect(v.string()
			.toSplit(/\s+/)
			.execute('a b c'))
			.toEqual({ value: ['a', 'b', 'c'] })
	})
})
