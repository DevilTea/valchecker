import { any, createValchecker } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [any] })
const schema = v.any()

// `any` owns no issue code and passes for every value, so it has no failure cell to
// write: the success cell is the whole contract.
stepBench('any', [
	{
		name: 'passes',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('hello'),
	},
])
