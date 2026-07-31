import { createValchecker, isEndingWith, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isEndingWith] })
const suffix = '.txt'
const schema = v.string()
	.isEndingWith(suffix)

stepBench('isEndingWith', [
	{
		name: 'matching-suffix',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('release-notes.txt'),
	},
	{
		name: 'other-suffix',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isEndingWith:expected_ending_with'] },
		batch: 100,
		run: () => schema.execute('release-notes.md'),
	},
])
