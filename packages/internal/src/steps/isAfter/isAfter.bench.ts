import { createValchecker, date, isAfter } from '../..'
import { stepBench } from '../../test-utils/step-bench'

// Hoisted, because `new Date(string)` parses and would dominate a cell whose own
// work is two `getTime()` calls.
const bound = new Date('2020-01-01T00:00:00.000Z')
const afterBound = new Date('2020-01-02T00:00:00.000Z')
const beforeBound = new Date('2019-12-31T00:00:00.000Z')

const v = createValchecker({ steps: [date, isAfter] })
const schema = v.date()
	.isAfter(bound)

stepBench('isAfter', [
	{
		name: 'after-bound',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(afterBound),
	},
	{
		// A valid `Date`, so it clears `date` and the bound comparison is what fails.
		name: 'before-bound',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isAfter:expected_after'] },
		batch: 100,
		run: () => schema.execute(beforeBound),
	},
])
