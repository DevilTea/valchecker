import { as, createValchecker, toValues } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [as, toValues] })

// `as` rather than `map({ key, value })`: the audited cell measured the enclosing
// structural walk over the entries, not the value iterator. `as` is type-only and
// installs no runtime step, so the unit is `execute()` plus this step.
const schema = v.as<Map<string, number>>()
	.toValues()

// Three entries: real iteration and allocation, without becoming a collection-size
// benchmark wearing the step's name.
const value = new Map([['a', 1], ['b', 2], ['c', 3]])

// `toValues` owns no issue code — no `SelfIssue` in its `Meta`, and the implementation is
// a single `success([...value.values()])` that cannot fail — so the success cell is its
// whole contract.
stepBench('toValues', [
	{
		name: 'map-values',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute(value),
	},
])
