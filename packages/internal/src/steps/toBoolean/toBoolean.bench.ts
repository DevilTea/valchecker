import { createValchecker, string, toBoolean } from '../..'
import { stepBench } from '../../test-utils/step-bench'

// The step owns no issue: it is `Boolean(value)` truthiness coercion, which cannot fail.
// So it has a success cell only, and no failure cell to be written.
const v = createValchecker({ steps: [string, toBoolean] })
const schema = v.string()
	.toBoolean()

stepBench('toBoolean', [
	{
		name: 'truthy-string',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('false'),
	},
])
