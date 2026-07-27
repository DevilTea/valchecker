import { bench, describe } from 'vitest'
import { createValchecker, isIp, string } from '../..'

const schema = createValchecker({ steps: [string, isIp] })
	.string()
	.isIp()

describe('isIp benchmarks', () => {
	bench('valid input', () => {
		schema.execute('192.168.0.1')
	})

	bench('invalid input', () => {
		schema.execute('256.0.0.1')
	})

	// IPv4 is one pattern test; IPv6 still splits and counts groups, and an
	// embedded IPv4 tail runs the IPv4 pattern as well. Different costs.
	bench('valid IPv6 input', () => {
		schema.execute('2001:db8::8a2e:370:7334')
	})

	bench('valid IPv6 with an embedded IPv4 tail', () => {
		schema.execute('::ffff:192.168.0.1')
	})

	bench('malformed input', () => {
		schema.execute('not-an-ip')
	})
})
