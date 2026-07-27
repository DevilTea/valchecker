import { describe, expect, it } from 'vitest'
import { createValchecker, isIp, string } from '../..'

const v = createValchecker({ steps: [string, isIp] })

const valid = [
	'192.168.0.1',
	'0.0.0.0',
	'255.255.255.255',
	'::1',
	'2001:db8::8a2e:370:7334',
	'::ffff:192.168.0.1',
	// The octet range lives in the pattern now, so each rule needs a case on both
	// sides of its edge.
	'9.99.199.255',
	'10.100.200.249',
	'1.0.0.0',
	'250.251.252.253',
]

const invalid = [
	'256.0.0.1',
	'1.2.3',
	'01.2.3.4',
	'1.2.3.4.5',
	'gggg::1',
	'1::2::3',
	'hello',
	'',
	'255.255.255.256',
	'260.1.1.1',
	'300.1.1.1',
	'999.1.1.1',
	'1.1.1.',
	'.1.1.1.1',
	'1..1.1',
	'1.1.1.1.',
	'00.1.1.1',
	'1.007.1.1',
	'+1.1.1.1',
	'1.1.1.1 ',
	' 1.1.1.1',
	// `$` is end of input, not end of line.
	'1.1.1.1\nbad',
	'bad\n1.1.1.1',
]

describe('isIp step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isIp()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isIp()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isIp:expected_ip' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isIp()
			.execute('256.0.0.1'))
			.toEqual({
				issues: [{
					code: 'isIp:expected_ip',
					category: 'validation',
					message: 'Expected a valid IP address.',
					path: [],
					payload: { value: '256.0.0.1', version: undefined },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isIp({ message: 'Custom' })
			.execute('256.0.0.1'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})

	it('restricts to a caller-supplied IP version', () => {
		expect(v.string()
			.isIp({ version: 4 })
			.execute('::1'))
			.toMatchObject({ issues: [{ code: 'isIp:expected_ip' }] })
		expect(v.string()
			.isIp({ version: 6 })
			.execute('1.2.3.4'))
			.toMatchObject({ issues: [{ code: 'isIp:expected_ip' }] })
	})
})
