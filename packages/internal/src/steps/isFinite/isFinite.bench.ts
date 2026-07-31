import { createValchecker, isFinite, number } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [number, isFinite] })
const schema = v.number()
	.isFinite()

stepBench('isFinite', [
	{
		name: 'finite',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(42),
	},
	{
		// `number` is a `typeof` check, so `Infinity` clears it and reaches this step.
		name: 'infinite',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isFinite:expected_finite'] },
		batch: 100,
		run: () => schema.execute(Number.POSITIVE_INFINITY),
	},
])
