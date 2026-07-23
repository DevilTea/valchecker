import { describe, expect, it } from 'vitest'
import { createValchecker, isEmail, string } from '../..'

const v = createValchecker({ steps: [string, isEmail] })

const valid = [
	'john.doe@example.com',
	'user+tag@sub.example.org',
	'x!#$%@example.com',
]

const invalid = [
	'plainaddress',
	'@missing-local.com',
	'a@@b.com',
	'user@exam ple.com',
	'',
]

describe('isEmail step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isEmail()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isEmail()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isEmail:expected_email' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isEmail()
			.execute('plainaddress'))
			.toEqual({
				issues: [{
					code: 'isEmail:expected_email',
					category: 'validation',
					message: 'Expected a valid email address.',
					path: [],
					payload: { value: 'plainaddress' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isEmail({ message: 'Custom' })
			.execute('plainaddress'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
