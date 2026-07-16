import { describe, expect, it } from 'vitest'
import { createValchecker, isLengthAtLeast, string } from '../..'

const v = createValchecker({ steps: [string, isLengthAtLeast] })

describe('string step plugin', () => {
	it.each(['hello', '', '你好'])('accepts string %p', (value) => {
		expect(v.string().execute(value)).toEqual({ value })
	})

	it.each([
		123,
		true,
		null,
		undefined,
		{},
		[],
		123n,
		Symbol('test'),
	])('rejects non-string %p', (value) => {
		expect(v.string().execute(value)).toEqual({
			issues: [{
				code: 'string:expected_string',
				message: 'Expected a string.',
				path: [],
				payload: { value },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.string('Custom error message').execute(123)).toEqual({
			issues: [{
				code: 'string:expected_string',
				message: 'Custom error message',
				path: [],
				payload: { value: 123 },
			}],
		})
	})

	it('chains with length validation', () => {
		expect(v.string().isLengthAtLeast(5).execute('hello')).toEqual({ value: 'hello' })
		expect(v.string().isLengthAtLeast(5).execute('hi')).toEqual({
			issues: [{
				code: 'isLengthAtLeast:expected_length_at_least',
				message: 'Expected a length of at least 5.',
				path: [],
				payload: { value: 'hi', minimum: 5 },
			}],
		})
	})
})