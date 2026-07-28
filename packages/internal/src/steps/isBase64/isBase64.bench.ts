import { createValchecker, isBase64, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isBase64] })
const schema = v.string()
	.isBase64()

stepBench('isBase64', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('aGVsbG8='),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isBase64:expected_base64'] },
		batch: 100,
		run: () => schema.execute('aGVsbG8'),
	},
])
