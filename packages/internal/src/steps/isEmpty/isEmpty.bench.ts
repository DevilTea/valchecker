import { createValchecker, isEmpty, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isEmpty] })
// The `.size` branch is reached only when `.length` is absent, and it then performs the
// same single property read compared against zero, so it is not a second algorithm.
const schema = v.string()
	.isEmpty()

stepBench('isEmpty', [
	{
		name: 'empty',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(''),
	},
	{
		name: 'populated',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isEmpty:expected_empty'] },
		batch: 100,
		run: () => schema.execute('value'),
	},
])
