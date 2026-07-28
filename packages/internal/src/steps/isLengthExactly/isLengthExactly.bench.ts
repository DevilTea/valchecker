import { createValchecker, isLengthExactly, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [isLengthExactly, string] })
const expectedLength = 8
const schema = v.string()
	.isLengthExactly(expectedLength)

stepBench('isLengthExactly', [
	{
		name: 'expected-length',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('password'),
	},
	{
		name: 'other-length',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isLengthExactly:expected_length_exactly'] },
		batch: 100,
		run: () => schema.execute('short'),
	},
])
