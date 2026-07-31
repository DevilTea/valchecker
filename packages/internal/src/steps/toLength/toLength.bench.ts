import { createValchecker, string, toLength } from '../..'
import { stepBench } from '../../test-utils/step-bench'

// The step owns no issue: it reads `value.length` off a value the previous step already
// proved has one. It therefore has a success cell only.
//
// It sits on `string` rather than `array`, because the cells this replaced spent almost
// all of their time in `array`'s child-execute loop — a 1,000-element cell measured
// `array`, not this one-property read.
const v = createValchecker({ steps: [string, toLength] })
const schema = v.string()
	.toLength()

stepBench('toLength', [
	{
		name: 'string-length',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('hello'),
	},
])
