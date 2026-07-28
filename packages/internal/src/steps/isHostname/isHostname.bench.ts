import { createValchecker, isHostname, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isHostname] })
const schema = v.string()
	.isHostname()

stepBench('isHostname', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('api.example.com'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isHostname:expected_hostname'] },
		batch: 100,
		run: () => schema.execute('-bad.example.com'),
	},
])
