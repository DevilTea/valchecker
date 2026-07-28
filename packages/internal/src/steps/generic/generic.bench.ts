import { createValchecker, generic, number, object, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [generic, number, object, string] })

const target = v.object({ id: v.string(), age: v.number() })
// The factory form is the only one with per-execution work of its own: it resolves the
// schema and runs its runtime steps through the shared loop on every execution. Handed a
// schema directly, `generic` installs that schema's steps at construction and adds
// nothing to the timed region, so a cell for it would measure `object`.
const schema = v.generic<{ output: { id: string, age: number } }>(() => target)

const valid = { id: 'u-1', age: 36 }

// `generic` owns no issue code, so a failure cell here would measure the resolved
// schema's failure rather than this step's.
stepBench('generic', [
	{
		name: 'factory-valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => schema.execute(valid),
	},
])
