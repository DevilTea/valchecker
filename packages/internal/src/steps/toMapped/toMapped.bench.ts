import { as, createValchecker, toMapped } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [as, toMapped] })

// `as` rather than `array(v.number())`/`set(v.number())`: the enclosing structural walk
// would be most of the unit and a `map`/`set` regression would fire here. `as` is
// type-only and installs no runtime step, so the unit is `execute()` plus this step.
const mappedArray = v.as<number[]>()
	.toMapped(item => item * 2)
// The Set branch is a second algorithm, not a second input: the array path delegates to
// `Array.prototype.map` under the callback-error sentinel, while the Set path runs its own
// loop and carries the mapped-item uniqueness bookkeeping. That bookkeeping is measured
// here, on the success path where every entry pays it, rather than by a duplicate-item
// failure cell that would only measure the moment it fires.
const mappedSet = v.as<Set<number>>()
	.toMapped(item => item * 2)
// Pre-allocated, because `new Error()` captures a stack and that cost belongs to V8
// rather than to this step's failure path.
const boom = new Error('boom')
const throwing = v.as<number[]>()
	.toMapped(() => {
		throw boom
	})

const array = [1, 2, 3]
const set = new Set([1, 2, 3])

stepBench('toMapped', [
	{
		name: 'array-mapped',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => mappedArray.execute(array),
	},
	{
		name: 'set-mapped',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => mappedSet.execute(set),
	},
	{
		// The sentinel path: the throw crosses `Array.prototype.map`, is recognised by
		// `runWithCallbackErrorSentinel`, and becomes this step's operation issue. Nothing
		// on the success path measures it.
		name: 'callback-failed',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['toMapped:callback_failed'] },
		batch: 10,
		run: () => throwing.execute(array),
	},
])
