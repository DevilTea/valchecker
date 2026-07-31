import { createValchecker, undefined_ } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [undefined_] })
const schema = v.undefined()

stepBench('undefined', [
	{
		name: 'undefined-value',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(undefined),
	},
	{
		name: 'defined',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['undefined:expected_undefined'] },
		batch: 100,
		run: () => schema.execute(null),
	},
])
