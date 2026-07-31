import { createValchecker, looseBigint } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [looseBigint] })
const schema = v.looseBigint()

stepBench('looseBigint', [
	{
		// A string, because a bigint input returns before the pattern test and `BigInt()`
		// conversion run, and would leave this coercing schema's actual work unmeasured.
		name: 'bigint-string',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => schema.execute('42'),
	},
	{
		name: 'non-bigint-string',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['looseBigint:expected_bigint'] },
		batch: 100,
		run: () => schema.execute('1.5'),
	},
])
