import { createValchecker, isHex, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isHex] })
const schema = v.string()
	.isHex()

stepBench('isHex', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('deadBEEF'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isHex:expected_hex'] },
		batch: 100,
		run: () => schema.execute('0x1f'),
	},
])
