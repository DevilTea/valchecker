import { createValchecker, string, toTrimmed } from '../..'
import { stepBench } from '../../test-utils/step-bench'

// The step owns no issue: `value.trim()` on a string cannot fail. It therefore has a
// success cell only — the failure cell this replaced passed a number, which failed in
// `string` and never reached this step at all.
const v = createValchecker({ steps: [string, toTrimmed] })
const schema = v.string()
	.toTrimmed()

stepBench('toTrimmed', [
	{
		name: 'padded',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('  hello  '),
	},
])
