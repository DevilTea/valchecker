import { createValchecker, string, toBigint } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, toBigint] })
const schema = v.string()
	.toBigint()

stepBench('toBigint', [
	{
		name: 'numeric-string',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => schema.execute('42'),
	},
	{
		// Unlike `toNumber`, native `BigInt()` throws on an unparseable string rather than
		// producing `NaN`, so a plain string does reach this step's own issue.
		name: 'conversion-failed',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['toBigint:conversion_failed'] },
		batch: 5,
		run: () => schema.execute('invalid'),
	},
])
