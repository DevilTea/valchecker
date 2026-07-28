import { createValchecker, isNaN, number } from '../..'
import { stepBench } from '../../test-utils/step-bench'

// `number` is a `typeof` check, so it admits `NaN` and this step is reachable in
// both directions.
const v = createValchecker({ steps: [number, isNaN] })
const schema = v.number()
	.isNaN()

stepBench('isNaN', [
	{
		name: 'nan',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(Number.NaN),
	},
	{
		name: 'ordinary-number',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isNaN:expected_nan'] },
		batch: 100,
		run: () => schema.execute(42),
	},
])
