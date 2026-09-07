import { describe, expect, it } from 'vitest'
import { createValchecker, isHostname, string } from '../..'

const v = createValchecker({ steps: [string, isHostname] })

const valid = [
	'example.com',
	'sub.domain.example.org',
	'localhost',
	'xn--d1acufc.xn--p1ai',
	// A label may be a single alphanumeric character, and hyphens are allowed
	// anywhere but at a label's edges.
	'a',
	'a-b.com',
	// RFC 1123 allows non-final labels to begin with a digit or be entirely
	// numeric. Only the highest-level label carries the numeric ambiguity rule.
	'123.example',
	'1.2.3.example',
	// Case-insensitive.
	'EXAMPLE.COM',
]

const invalid = [
	'-bad.com',
	'bad-.com',
	'exa mple.com',
	'a..b',
	'',
	// The pattern has no empty final label, so the fully qualified form with a
	// trailing root dot is rejected.
	'example.com.',
	// Underscore is not in the label alphabet, so a DNS name that carries one
	// is not a hostname here.
	'a_b.com',
	'_sip._tcp.example.com',
	// An RFC 1123 host name cannot end in an all-numeric highest-level label;
	// this also keeps dotted-decimal IPv4 text distinct from host names.
	'example.123',
	'1.2.3.4',
	'123',
	// `$` without the `m` flag is end-of-input.
	'example.com\n',
]

describe('isHostname step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isHostname()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isHostname()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isHostname:expected_hostname' }] })
	})

	it('bounds a label at 63 characters', () => {
		const schema = v.string()
			.isHostname()
		expect(schema.execute('a'.repeat(63)))
			.toEqual({ value: 'a'.repeat(63) })
		expect(schema.execute('a'.repeat(64)))
			.toMatchObject({ issues: [{ code: 'isHostname:expected_hostname' }] })
	})

	it('bounds the whole name at 253 characters', () => {
		const schema = v.string()
			.isHostname()
		// Three 63-character labels and a fourth of 61, joined by three dots.
		const at253 = `${['a'.repeat(63), 'a'.repeat(63), 'a'.repeat(63)].join('.')}.${'a'.repeat(61)}`
		expect(at253)
			.toHaveLength(253)
		expect(schema.execute(at253))
			.toEqual({ value: at253 })
		expect(schema.execute(`${at253}a`))
			.toMatchObject({ issues: [{ code: 'isHostname:expected_hostname' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isHostname()
			.execute('-bad.com'))
			.toEqual({
				issues: [{
					code: 'isHostname:expected_hostname',
					category: 'validation',
					message: 'Expected a valid hostname.',
					path: [],
					payload: { value: '-bad.com' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isHostname({ message: 'Custom' })
			.execute('-bad.com'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
