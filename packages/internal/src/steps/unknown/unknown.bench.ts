import { createValchecker, unknown } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [unknown] })
const schema = v.unknown()

// `unknown` owns no issue code and passes for every value, so it has no failure cell to
// write: the success cell is the whole contract.
stepBench('unknown', [
	{
		name: 'passes',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('hello'),
	},
])
