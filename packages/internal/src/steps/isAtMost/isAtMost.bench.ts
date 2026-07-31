import { createValchecker, isAtMost, number } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [number, isAtMost] })
const schema = v.number()
	.isAtMost(100)

stepBench('isAtMost', [
	{
		name: 'satisfied',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(5),
	},
	{
		// A number, so it clears `number` and the comparison is what fails.
		name: 'above-maximum',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isAtMost:expected_at_most'] },
		batch: 100,
		run: () => schema.execute(101),
	},
])
