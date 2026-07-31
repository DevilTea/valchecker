import { createValchecker, isMatching, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [isMatching, string] })
const pattern = /^[a-z]+$/
const schema = v.string()
	.isMatching(pattern)

stepBench('isMatching', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('value'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isMatching:expected_matching'] },
		batch: 100,
		run: () => schema.execute('123'),
	},
])
