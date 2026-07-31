import { as, createValchecker, toSorted } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [as, toSorted] })

// `as` rather than `array(v.any())`: the enclosing structural walk would be most of the
// unit and an `array` regression would fire here. `as` is type-only and installs no
// runtime step, so the unit is `execute()` plus this step.
const defaultOrder = v.as<number[]>()
	.toSorted()
// The two comparator states are two algorithms rather than two option values: without a
// comparator the step delegates straight to `Array.prototype.toSorted` and never installs
// the callback-error sentinel, so nothing in the cell above can measure the wrapping,
// the try/catch per comparison, or the sentinel rethrow.
const comparator = v.as<number[]>()
	.toSorted({ compareFn: (left, right) => left - right })
// Pre-allocated, because `new Error()` captures a stack and that cost belongs to V8
// rather than to this step's failure path.
const boom = new Error('boom')
const throwing = v.as<number[]>()
	.toSorted({
		compareFn: () => {
			throw boom
		},
	})

// Unsorted, so the comparator is genuinely invoked several times.
const value = [5, 3, 9, 1, 7, 2]

stepBench('toSorted', [
	{
		name: 'default-order',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => defaultOrder.execute(value),
	},
	{
		name: 'comparator',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => comparator.execute(value),
	},
	{
		name: 'comparator-failed',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['toSorted:callback_failed'] },
		batch: 10,
		run: () => throwing.execute(value),
	},
])
