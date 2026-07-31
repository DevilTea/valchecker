import { describe, expect, it } from 'vitest'
import { createValchecker, isMac, string } from '../..'

const v = createValchecker({ steps: [string, isMac] })

const valid = [
	'00:1A:2B:3C:4D:5E',
	'aa-bb-cc-dd-ee-ff',
	// Each separator position is independent, so a mixed form is accepted. This
	// is the documented looseness of the current pattern.
	'00:1A-2B:3C-4D:5E',
	// Case-insensitive, and either case may be mixed within an octet.
	'Aa:bB:cC:dD:eE:fF',
]

const invalid = [
	'00:1A:2B:3C:4D',
	'001A2B3C4D5E',
	'gg:11:22:33:44:55',
	'00:1A:2B:3C:4D:5E:6F',
	'',
	// EUI-64 is eight octets, not six, so it is not a MAC address here.
	'00:1A:2B:3C:4D:5E:6F:70',
	// Only `:` and `-` separate octets: the Cisco dotted-triple form is not
	// accepted, and neither is a dot in place of a colon.
	'0011.2233.4455',
	'00.1A.2B.3C.4D.5E',
	// Every octet is exactly two hexadecimal digits, never one or three.
	'0:1:2:3:4:5',
	'000:1A:2B:3C:4D:5E',
	// A separator may not close the string, and `$` without the `m` flag is
	// end-of-input.
	'00:1A:2B:3C:4D:5E:',
	'00:1A:2B:3C:4D:5E\n',
]

describe('isMac step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isMac()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isMac()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isMac:expected_mac' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isMac()
			.execute('001A2B3C4D5E'))
			.toEqual({
				issues: [{
					code: 'isMac:expected_mac',
					category: 'validation',
					message: 'Expected a valid MAC address.',
					path: [],
					payload: { value: '001A2B3C4D5E' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isMac({ message: 'Custom' })
			.execute('001A2B3C4D5E'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
