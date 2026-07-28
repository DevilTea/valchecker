import { blob, createValchecker } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [blob] })
const schema = v.blob()
// Hoisted, because constructing a `Blob` costs far more than the `instanceof` check the
// cell exists to measure.
const validBlob = new Blob(['data'])

stepBench('blob', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(validBlob),
	},
	{
		name: 'non-blob',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['blob:expected_blob'] },
		batch: 100,
		run: () => schema.execute('not a blob'),
	},
])
