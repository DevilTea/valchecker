import { createValchecker, fallback, number } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [fallback, number] })

const recovering = v.number()
	.fallback(() => 0)
// Pre-allocated, because `new Error()` captures a stack and that cost belongs to V8
// rather than to this step's failure path.
const boom = new Error('boom')
const throwing = v.number()
	.fallback(() => {
		throw boom
	})
// `fallback` runs on a failure step and its callback may return a promise, so it is one of
// the steps that can put the pipeline on the asynchronous path — measured until now by
// `toAsync` alone.
const asynchronous = v.number()
	.fallback(async () => 0)

// A value that fails `number()`. Every cell here needs one: `fallback` installs a failure
// step, so a passing input never enters its code at all and a "success" cell on `42` would
// measure `number()` and the maybe-async pipeline instead of this step.
const value = 'not-a-number'

stepBench('fallback', [
	{
		// The recovery path, and the reason this cell exists: reaching it runs
		// `hasInternalIssue()` over the received issues, the defensive snapshot of them, and
		// the callback, and it ends in a success. That decision is the step's whole subject
		// and nothing else in the tree measures it.
		name: 'recovers',
		group: 'warm/success',
		expect: { success: true },
		batch: 10,
		run: () => recovering.execute(value),
	},
	{
		// A throwing getter keeps the original issues and appends this step's own, so both
		// codes are what the result really carries.
		name: 'callback-failed',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['number:expected_number', 'fallback:failed'] },
		batch: 5,
		run: () => throwing.execute(value),
	},
	{
		name: 'async-recovers',
		group: 'warm/async/success',
		expect: { success: true },
		batch: 5,
		async: true,
		run: () => asynchronous.execute(value),
	},
])
