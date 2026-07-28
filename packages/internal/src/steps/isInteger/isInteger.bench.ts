import { createValchecker, isInteger, number } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [number, isInteger] })
const schema = v.number()
	.isInteger()

stepBench('isInteger', [
	{
		name: 'integer',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(42),
	},
	{
		name: 'fractional',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isInteger:expected_integer'] },
		batch: 100,
		run: () => schema.execute(1.5),
	},
])
