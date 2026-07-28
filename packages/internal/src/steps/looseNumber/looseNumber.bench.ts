import { createValchecker, looseNumber } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [looseNumber] })
const schema = v.looseNumber()

stepBench('looseNumber', [
	{
		// A string, because a number input returns before `parseNumberLiteral()` runs and
		// would leave this coercing schema's actual work unmeasured.
		name: 'numeric-string',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('42'),
	},
	{
		name: 'non-numeric-string',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['looseNumber:expected_number'] },
		batch: 100,
		run: () => schema.execute('not-a-number'),
	},
])
