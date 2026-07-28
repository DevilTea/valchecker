import { createValchecker, isNanoid, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isNanoid] })
const schema = v.string()
	.isNanoid()

stepBench('isNanoid', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('V1StGXR8_Z5jdHi6B-myT'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isNanoid:expected_nanoid'] },
		batch: 100,
		run: () => schema.execute('V1StGXR8 Z5jdHi6B-myT'),
	},
])
