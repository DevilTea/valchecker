import { createValchecker, isLessThan, number } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [isLessThan, number] })
const schema = v.number()
	.isLessThan(10)

stepBench('isLessThan', [
	{
		name: 'satisfied',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(5),
	},
	{
		// A number, so it clears `number` and the comparison is what fails.
		name: 'not-less',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isLessThan:expected_less_than'] },
		batch: 100,
		run: () => schema.execute(42),
	},
])
