import { createValchecker, isMac, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isMac] })
const schema = v.string()
	.isMac()

stepBench('isMac', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('00:1A:2B:3C:4D:5E'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isMac:expected_mac'] },
		batch: 100,
		run: () => schema.execute('00:1A:2B:3C:4D'),
	},
])
