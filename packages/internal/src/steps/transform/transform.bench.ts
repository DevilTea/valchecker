import { createValchecker, string, transform } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, transform] })

const schema = v.string()
	.transform(value => value.length)
// Pre-allocated, because `new Error()` captures a stack and that cost belongs to V8
// rather than to this step's failure path.
const boom = new Error('boom')
// The input below is a valid string, so this cell reaches the transform. The cell it
// replaces executed `123` against `v.string().transform(...)` and measured
// `string:expected_string`: the step under test never ran.
const throwing = v.string()
	.transform(() => {
		throw boom
	})
// `transform` is the reason a schema leaves the synchronous fast path, and until now the
// asynchronous pipeline was measured by `toAsync` alone. A promise-returning callback is
// the ordinary way to reach it, so it gets a cell here.
const asynchronous = v.string()
	.transform(async value => value.length)

const value = 'valchecker'

stepBench('transform', [
	{
		name: 'sync-callback',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute(value),
	},
	{
		name: 'callback-failed',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['transform:callback_failed'] },
		batch: 20,
		run: () => throwing.execute(value),
	},
	{
		name: 'async-callback',
		group: 'warm/async/success',
		expect: { success: true },
		batch: 5,
		async: true,
		run: () => asynchronous.execute(value),
	},
])
