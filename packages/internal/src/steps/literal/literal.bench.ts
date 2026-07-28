import { createValchecker, literal } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [literal] })
// The operand kind changes what `literal()` records at construction, not how it compares:
// execution is one `Object.is` for every literal kind, so one operand covers the step.
// The previous pair wrapped two 1,000-character `String.repeat` allocations around that
// single comparison, which made the allocation the measurement.
const schema = v.literal('hello')

stepBench('literal', [
	{
		name: 'match',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('hello'),
	},
	{
		name: 'mismatch',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['literal:expected_literal'] },
		batch: 100,
		run: () => schema.execute('world'),
	},
])
