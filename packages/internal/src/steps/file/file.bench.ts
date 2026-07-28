import { createValchecker, file } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [file] })
const schema = v.file()
// Hoisted, because constructing a `File` costs far more than the `instanceof` check the
// cell exists to measure.
const validFile = new File(['data'], 'name.txt')

stepBench('file', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(validFile),
	},
	{
		name: 'non-file',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['file:expected_file'] },
		batch: 100,
		run: () => schema.execute('not a file'),
	},
])
