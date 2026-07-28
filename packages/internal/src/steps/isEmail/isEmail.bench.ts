import { createValchecker, isEmail, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isEmail] })
const schema = v.string()
	.isEmail()

stepBench('isEmail', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('john.doe@example.com'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isEmail:expected_email'] },
		batch: 100,
		run: () => schema.execute('plainaddress'),
	},
])
