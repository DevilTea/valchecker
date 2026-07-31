import { createValchecker, date } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [date] })
const schema = v.date()
const valid = new Date('2020-01-01T00:00:00.000Z')

stepBench('date', [
	{
		// The success path already walks both of this step's checks — `instanceof Date` and
		// the `getTime()` NaN test — so `date:invalid_date` needs no cell of its own: it is
		// the same traversal ending in the issue creation `expected-date` already measures.
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute(valid),
	},
	{
		name: 'non-date',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['date:expected_date'] },
		batch: 100,
		run: () => schema.execute('2020-01-01'),
	},
])
