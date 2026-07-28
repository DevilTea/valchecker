import { createValchecker, looseBoolean } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [looseBoolean] })
const schema = v.looseBoolean()

stepBench('looseBoolean', [
	{
		// A string, because a boolean input returns before the string comparisons run and
		// would leave this coercing schema's actual work unmeasured.
		name: 'boolean-string',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('true'),
	},
	{
		name: 'other-string',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['looseBoolean:expected_boolean'] },
		batch: 100,
		run: () => schema.execute('TRUE'),
	},
])
