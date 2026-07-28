import { createValchecker, isLengthAtMost, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isLengthAtMost] })
const maximumLength = 10
const schema = v.string()
	.isLengthAtMost(maximumLength)

stepBench('isLengthAtMost', [
	{
		name: 'short-enough',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('value'),
	},
	{
		name: 'too-long',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isLengthAtMost:expected_length_at_most'] },
		batch: 100,
		run: () => schema.execute('a considerably longer value'),
	},
])
