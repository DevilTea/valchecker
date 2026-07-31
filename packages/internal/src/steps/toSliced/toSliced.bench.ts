import { as, createValchecker, toSliced } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [as, toSliced] })

// `as` rather than `array(v.any())`: the enclosing structural walk would be most of the
// unit and an `array` regression would fire here. `as` is type-only and installs no
// runtime step, so the unit is `execute()` plus this step, which is one `value.slice()`
// call with the stored parameters.
const schema = v.as<number[]>()
	.toSliced(1, 4)

const value = [1, 2, 3, 4, 5, 6]

// `toSliced` owns no issue code — no `SelfIssue` in its `Meta`, and the implementation is
// a single `success(value.slice(...params))` — so the success cell is its whole contract.
// The step's own signature is whatever the current value's `slice` accepts, so there is
// no second algorithm behind an option either.
stepBench('toSliced', [
	{
		name: 'array-sliced',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute(value),
	},
])
