import { check, createValchecker, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [check, string] })

// `string()` costs one `typeof` and gives the predicate a real value to read, which
// `v.check(() => true).execute(undefined)` — the cell this replaces — did not.
const schema = v.string()
	.check(value => value.length > 0)
const failing = v.string()
	.check(value => value.length > 100)
// `check` is one of the two reasons a schema leaves the synchronous fast path, and until
// now the asynchronous pipeline was measured by `toAsync` alone. A promise-returning
// predicate is the ordinary way to reach it, so it gets a cell here.
const asynchronous = v.string()
	.check(async value => value.length > 0)

const value = 'valchecker'

stepBench('check', [
	{
		name: 'passes',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => schema.execute(value),
	},
	{
		// Returning `false`, which is the ordinary failure. `check:callback_failed` is the
		// same issue construction reached through a throw, so it is not a second cell.
		name: 'returned-false',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['check:failed'] },
		batch: 20,
		run: () => failing.execute(value),
	},
	{
		name: 'async-passes',
		group: 'warm/async/success',
		expect: { success: true },
		batch: 5,
		async: true,
		run: () => asynchronous.execute(value),
	},
])
