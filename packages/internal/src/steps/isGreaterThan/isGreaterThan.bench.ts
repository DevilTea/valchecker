import { createValchecker, isGreaterThan, number } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [isGreaterThan, number] })
const schema = v.number()
	.isGreaterThan(0)

stepBench('isGreaterThan', [
	{
		name: 'satisfied',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(5),
	},
	{
		// A number, so it clears `number` and the comparison is what fails.
		name: 'not-greater',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isGreaterThan:expected_greater_than'] },
		batch: 100,
		run: () => schema.execute(-1),
	},
])
