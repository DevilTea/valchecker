import { as, createValchecker, toArray } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [as, toArray] })

// `as` rather than `set(v.string())`. The audited cell sat on `v.set(...)` over a
// thousand items, where the structural walk was 90% of the unit and the spread was
// invisible: a `set` regression fired here and a `toArray` regression did not. `as` is
// type-only — its implementation is `noop`, so it installs no runtime step — and the
// unit is therefore `execute()` plus this step and nothing else.
const schema = v.as<Set<string>>()
	.toArray()

// Three items: enough that copying is real work, small enough that this is not a
// collection-size benchmark wearing the step's name.
const value = new Set(['a', 'b', 'c'])

// `toArray` owns no issue code — its `Meta` declares no `SelfIssue`, and the
// implementation is a single `success([...value])` that cannot fail — so there is no
// own-issue failure to measure and the success cell is its whole contract.
stepBench('toArray', [
	{
		name: 'set-to-array',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute(value),
	},
])
