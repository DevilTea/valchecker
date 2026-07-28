import { createValchecker, isDefined, unknown } from '../..'
import { stepBench } from '../../test-utils/step-bench'

// `unknown` accepts anything, which is what lets `undefined` reach this step rather
// than failing in the base.
const v = createValchecker({ steps: [isDefined, unknown] })
const schema = v.unknown()
	.isDefined()

stepBench('isDefined', [
	{
		name: 'defined',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('value'),
	},
	{
		name: 'undefined-value',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isDefined:expected_defined'] },
		batch: 100,
		run: () => schema.execute(undefined),
	},
])
