import { createValchecker, isNotEmpty, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isNotEmpty] })
// The `.size` branch is reached only when `.length` is absent, and it then performs the
// same single property read compared against zero, so it is not a second algorithm.
const schema = v.string()
	.isNotEmpty()

stepBench('isNotEmpty', [
	{
		name: 'populated',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('value'),
	},
	{
		name: 'empty',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isNotEmpty:expected_not_empty'] },
		batch: 100,
		run: () => schema.execute(''),
	},
])
