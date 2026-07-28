import { createValchecker, isEqualTo, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [isEqualTo, string] })
const schema = v.string()
	.isEqualTo('ready')

stepBench('isEqualTo', [
	{
		name: 'equal',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('ready'),
	},
	{
		// A string, so it clears `string` and `Object.is` is what rejects it.
		name: 'not-equal',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isEqualTo:expected_equal_to'] },
		batch: 100,
		run: () => schema.execute('pending'),
	},
])
