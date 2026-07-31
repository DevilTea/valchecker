import { describe, expect, it } from 'vitest'
import { createValchecker, isEmail, string } from '../..'

const v = createValchecker({ steps: [string, isEmail] })

const valid = [
	'john.doe@example.com',
	'user+tag@sub.example.org',
	'x!#$%@example.com',
	// The WHATWG pattern's local part is `[A-Za-z0-9_.!#$%&'*+/=?^`{|}~-]+`, so
	// `_` and a backtick belong to it just as `+` does.
	'a_b@example.com',
	'a`b@example.com',
	// It constrains only which characters the local part is built from, not
	// where the dots sit. An RFC 5322 reading rejects all three of these.
	'.ada@example.com',
	'ada.@example.com',
	'a..b@example.com',
	// The domain is a sequence of one or more labels, so a single label with no
	// dot is accepted — this is the step's stated departure from a full parser.
	'ada@example',
	// Case-insensitive throughout.
	'A@EXAMPLE.COM',
]

const invalid = [
	'plainaddress',
	'@missing-local.com',
	'a@@b.com',
	'user@exam ple.com',
	'',
	// A label must start and end with an alphanumeric character, so a trailing
	// root dot, an empty label, and an edge hyphen all fail.
	'ada@example.com.',
	'ada@example..com',
	'ada@-example.com',
	'ada@example-.com',
	// The pattern has no quoted-string or address-literal production, and its
	// character classes are ASCII, so a unicode local part fails too.
	'"john doe"@example.com',
	'ada@[127.0.0.1]',
	'josé@example.com',
	// `$` without the `m` flag is end-of-input, not end-of-line.
	'ada@example.com\n',
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

	it('bounds a domain label at 63 characters', () => {
		const schema = v.string()
			.isEmail()
		expect(schema.execute(`ada@${'a'.repeat(63)}.com`))
			.toEqual({ value: `ada@${'a'.repeat(63)}.com` })
		expect(schema.execute(`ada@${'a'.repeat(64)}.com`))
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
