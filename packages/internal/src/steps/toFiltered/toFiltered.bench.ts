import { as, createValchecker, toFiltered } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [as, toFiltered] })

// `as` rather than `array(v.any())`/`set(v.any())`: the enclosing structural walk would be
// most of the unit and an `array`/`set` regression would fire here. `as` is type-only and
// installs no runtime step, so the unit is `execute()` plus this step.
const filteredArray = v.as<number[]>()
	.toFiltered(item => item % 2 === 0)
// The Set branch is a second algorithm, not a second input: the array path delegates to
// `Array.prototype.filter` under the callback-error sentinel, while the Set path runs its
// own loop and rebuilds a Set.
const filteredSet = v.as<Set<number>>()
	.toFiltered(item => item % 2 === 0)
// Pre-allocated, because `new Error()` captures a stack and that cost belongs to V8
// rather than to this step's failure path.
const boom = new Error('boom')
const throwing = v.as<number[]>()
	.toFiltered(() => {
		throw boom
	})

const array = [1, 2, 3, 4]
const set = new Set(array)

stepBench('toFiltered', [
	{
		name: 'array-filtered',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => filteredArray.execute(array),
	},
	{
		name: 'set-filtered',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => filteredSet.execute(set),
	},
	{
		// The sentinel path: the throw crosses `Array.prototype.filter`, is recognised by
		// `runWithCallbackErrorSentinel`, and becomes this step's operation issue.
		name: 'callback-failed',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['toFiltered:callback_failed'] },
		batch: 10,
		run: () => throwing.execute(array),
	},
])
