import { createValchecker, null_ } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [null_] })
const schema = v.null()

stepBench('null', [
	{
		name: 'null-value',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(null),
	},
	{
		name: 'non-null',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['null:expected_null'] },
		batch: 100,
		run: () => schema.execute(undefined),
	},
])
