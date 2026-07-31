import { createValchecker, isLengthAtLeast, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isLengthAtLeast] })
const minimumLength = 3
const schema = v.string()
	.isLengthAtLeast(minimumLength)

stepBench('isLengthAtLeast', [
	{
		name: 'long-enough',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('value'),
	},
	{
		name: 'too-short',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isLengthAtLeast:expected_length_at_least'] },
		batch: 100,
		run: () => schema.execute('ab'),
	},
])
