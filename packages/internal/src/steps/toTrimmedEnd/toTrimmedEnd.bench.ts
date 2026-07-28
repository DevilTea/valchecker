import { createValchecker, string, toTrimmedEnd } from '../..'
import { stepBench } from '../../test-utils/step-bench'

// The step owns no issue: `value.trimEnd()` on a string cannot fail. It therefore has a
// success cell only — the failure cell this replaced passed a number, which failed in
// `string` and never reached this step at all.
const v = createValchecker({ steps: [string, toTrimmedEnd] })
const schema = v.string()
	.toTrimmedEnd()

stepBench('toTrimmedEnd', [
	{
		name: 'padded-end',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('hello  '),
	},
])
