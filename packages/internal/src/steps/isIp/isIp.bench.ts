import { createValchecker, isIp, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isIp] })
const schema = v.string()
	.isIp()
// `version` selects between two matchers rather than narrowing one: IPv4 is a
// single pattern test, IPv6 splits on `::`, counts groups and tests each. The
// default accepts an IPv4 address on the first matcher, so the IPv6 matcher is
// the branch that needs a cell of its own.
const ipv6Only = v.string()
	.isIp({ version: 6 })

stepBench('isIp', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('192.168.0.1'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isIp:expected_ip'] },
		batch: 50,
		run: () => schema.execute('256.0.0.1'),
	},
	{
		name: 'valid-ipv6',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => ipv6Only.execute('2001:db8::8a2e:370:7334'),
	},
])
