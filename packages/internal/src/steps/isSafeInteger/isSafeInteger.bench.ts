import { createValchecker, isSafeInteger, number } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [isSafeInteger, number] })
const schema = v.number()
	.isSafeInteger()

stepBench('isSafeInteger', [
	{
		name: 'safe-integer',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(42),
	},
	{
		name: 'fractional',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isSafeInteger:expected_safe_integer'] },
		batch: 100,
		run: () => schema.execute(1.5),
	},
])
