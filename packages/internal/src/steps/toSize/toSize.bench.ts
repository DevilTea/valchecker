import { as, createValchecker, toSize } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [as, toSize] })

// `as` rather than `set(v.string())`: the audited cell measured the enclosing structural
// walk over the items, not the `size` read. `as` is type-only and installs no runtime
// step, so everything outside this step is `execute()` itself.
//
// This is still the least attributable cell in the slice, and no container can fix that:
// the implementation is `success(value.size)`, one property read, so the execution
// boundary dominates the unit however small the input is. The cell catches that read
// becoming something other than a read; it cannot resolve a few percent.
const schema = v.as<Set<string>>()
	.toSize()

const value = new Set(['a', 'b', 'c'])

// `toSize` owns no issue code — no `SelfIssue` in its `Meta`, and the implementation
// cannot fail — so the success cell is its whole contract.
stepBench('toSize', [
	{
		name: 'set-size',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(value),
	},
])
