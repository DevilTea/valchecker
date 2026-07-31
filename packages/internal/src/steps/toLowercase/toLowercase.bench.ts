import { createValchecker, string, toLowercase } from '../..'
import { stepBench } from '../../test-utils/step-bench'

// The step owns no issue: `value.toLowerCase()` on a string cannot fail. It therefore has
// a success cell only — the failure cell this replaced passed a number, which failed in
// `string` and never reached this step at all.
const v = createValchecker({ steps: [string, toLowercase] })
const schema = v.string()
	.toLowercase()

stepBench('toLowercase', [
	{
		name: 'mixed-case',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('Hello World'),
	},
])
