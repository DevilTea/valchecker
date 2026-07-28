import { createValchecker, string, toDate } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, toDate] })
const schema = v.string()
	.toDate()

stepBench('toDate', [
	{
		name: 'iso-string',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => schema.execute('2020-01-01T00:00:00.000Z'),
	},
	{
		// `new Date('nope')` does not throw; it produces an Invalid Date, and the step's own
		// `getTime()` check is what turns that into its issue.
		name: 'conversion-failed',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['toDate:conversion_failed'] },
		batch: 20,
		run: () => schema.execute('nope'),
	},
])
