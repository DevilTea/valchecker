import { createValchecker, string, toNormalized } from '../..'
import { stepBench } from '../../test-utils/step-bench'

// The step owns no issue: an unsupported `form` throws while the schema is built, so
// nothing can fail during execution. It therefore has a success cell only — the cell
// named `failed execution` this replaced measured a plain string that normalized
// successfully.
//
// `form` selects no second path through this library: the option is validated once at
// construction and then handed to `value.normalize(form)`, so every form is the same
// library code and only the host's normalization differs. One cell covers it.
const v = createValchecker({ steps: [string, toNormalized] })
const schema = v.string()
	.toNormalized()

stepBench('toNormalized', [
	{
		name: 'decomposed-input',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => schema.execute('e\u0301cole'),
	},
])
