import { createValchecker, isBase64Url, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isBase64Url] })
const schema = v.string()
	.isBase64Url()

stepBench('isBase64Url', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('aGVsbG8'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isBase64Url:expected_base64_url'] },
		batch: 100,
		run: () => schema.execute('a+b/c'),
	},
])
