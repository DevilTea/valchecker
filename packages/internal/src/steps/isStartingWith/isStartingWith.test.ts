import { describe, expect, it } from 'vitest'
import { createValchecker, isStartingWith, string } from '../..'

const v = createValchecker({ steps: [string, isStartingWith] })

describe('isStartingWith step plugin', () => {
	it('accepts matching prefixes', () => {
		expect(v.string().isStartingWith('hello').execute('hello world')).toEqual({ value: 'hello world' })
	})

	it('rejects non-matching prefixes', () => {
		expect(v.string().isStartingWith('hello').execute('world')).toEqual({
			issues: [{
				code: 'isStartingWith:expected_starting_with',
				category: 'validation',
				message: 'Expected the string to start with "hello".',
				path: [],
				payload: { value: 'world', prefix: 'hello' },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.string().isStartingWith('x', 'Custom prefix').execute('value')).toMatchObject({
			issues: [{ message: 'Custom prefix' }],
		})
	})
})
