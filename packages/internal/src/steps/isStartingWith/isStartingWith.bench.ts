import { createValchecker, isStartingWith, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isStartingWith] })
const prefix = 'https://'
const schema = v.string()
	.isStartingWith(prefix)

stepBench('isStartingWith', [
	{
		name: 'matching-prefix',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('https://example.com/docs'),
	},
	{
		name: 'other-prefix',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isStartingWith:expected_starting_with'] },
		batch: 100,
		run: () => schema.execute('ftp://example.com/docs'),
	},
])
