import { createValchecker, isNonNullish, unknown } from '../..'
import { stepBench } from '../../test-utils/step-bench'

// `unknown` accepts anything, which is what lets a nullish value reach this step
// rather than failing in the base.
const v = createValchecker({ steps: [isNonNullish, unknown] })
const schema = v.unknown()
	.isNonNullish()

stepBench('isNonNullish', [
	{
		name: 'non-nullish',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('value'),
	},
	{
		name: 'null-value',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isNonNullish:expected_non_nullish'] },
		batch: 100,
		run: () => schema.execute(null),
	},
])
