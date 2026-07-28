import { createValchecker, never } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [never] })
const schema = v.never()

// `never` fails for every value, so it is the one step with no success cell to write.
stepBench('never', [
	{
		name: 'rejects',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['never:expected_never'] },
		batch: 100,
		run: () => schema.execute('hello'),
	},
])
