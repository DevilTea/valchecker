import { createValchecker, string, toUppercase } from '../..'
import { stepBench } from '../../test-utils/step-bench'

// The step owns no issue: `value.toUpperCase()` on a string cannot fail. It therefore has
// a success cell only — the failure cell this replaced passed a number, which failed in
// `string` and never reached this step at all.
const v = createValchecker({ steps: [string, toUppercase] })
const schema = v.string()
	.toUppercase()

stepBench('toUppercase', [
	{
		name: 'mixed-case',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('Hello World'),
	},
])
