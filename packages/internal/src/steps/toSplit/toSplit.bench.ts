import { createValchecker, string, toSplit } from '../..'
import { stepBench } from '../../test-utils/step-bench'

// The step owns no issue: it forwards its params to `value.split()`, which cannot fail on
// a string. It therefore has a success cell only.
const v = createValchecker({ steps: [string, toSplit] })
const schema = v.string()
	.toSplit(',')
// A RegExp separator runs the pattern matcher instead of a substring search, which is a
// different algorithm behind the same call rather than a second input to one.
const byPattern = v.string()
	.toSplit(/\s*,\s*/)

stepBench('toSplit', [
	{
		name: 'string-separator',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('a,b,c'),
	},
	{
		name: 'regexp-separator',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => byPattern.execute('a , b,c'),
	},
])
