import { createValchecker, isNonNull, unknown } from '../..'
import { stepBench } from '../../test-utils/step-bench'

// `unknown` accepts anything, which is what lets `null` reach this step rather than
// failing in the base.
const v = createValchecker({ steps: [isNonNull, unknown] })
const schema = v.unknown()
	.isNonNull()

stepBench('isNonNull', [
	{
		name: 'non-null',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('value'),
	},
	{
		name: 'null-value',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isNonNull:expected_non_null'] },
		batch: 100,
		run: () => schema.execute(null),
	},
])
