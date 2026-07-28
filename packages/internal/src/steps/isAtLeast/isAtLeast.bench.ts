import { createValchecker, isAtLeast, number } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [number, isAtLeast] })
const schema = v.number()
	.isAtLeast(0)

stepBench('isAtLeast', [
	{
		name: 'satisfied',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(5),
	},
	{
		// A number, so it clears `number` and the comparison is what fails.
		name: 'below-minimum',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isAtLeast:expected_at_least'] },
		batch: 100,
		run: () => schema.execute(-1),
	},
])
