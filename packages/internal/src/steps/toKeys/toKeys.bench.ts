import { as, createValchecker, toKeys } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [as, toKeys] })

// `as` rather than `map({ key, value })`. The audited cell sat on `v.map(...)` over a
// thousand entries, where the structural walk was 90% of the unit: a `map` regression
// fired here and a `toKeys` regression did not. `as` is type-only and installs no runtime
// step, so the unit is `execute()` plus this step.
const schema = v.as<Map<string, number>>()
	.toKeys()

// Three entries: the key iterator and the array allocation are real work at this size,
// and the cell is not a collection-size benchmark wearing the step's name.
const value = new Map([['a', 1], ['b', 2], ['c', 3]])

// `toKeys` owns no issue code — no `SelfIssue` in its `Meta`, and the implementation is a
// single `success([...value.keys()])` that cannot fail — so the success cell is its whole
// contract.
stepBench('toKeys', [
	{
		name: 'map-keys',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute(value),
	},
])
