import { as, createValchecker, toEntries } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [as, toEntries] })

// `as` rather than `map({ key, value })`: the audited cell measured the enclosing
// structural walk over the entries, not the entry iterator and its tuple allocations.
// `as` is type-only and installs no runtime step, so the unit is `execute()` plus this
// step.
const schema = v.as<Map<string, number>>()
	.toEntries()

// Three entries: three tuples allocated, which is real work, without becoming a
// collection-size benchmark wearing the step's name.
const value = new Map([['a', 1], ['b', 2], ['c', 3]])

// `toEntries` owns no issue code — no `SelfIssue` in its `Meta`, and the implementation
// is a single `success([...value.entries()])` that cannot fail — so the success cell is
// its whole contract.
stepBench('toEntries', [
	{
		name: 'map-entries',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => schema.execute(value),
	},
])
