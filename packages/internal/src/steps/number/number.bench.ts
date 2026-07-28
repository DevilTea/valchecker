import { createValchecker, number } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [number] })
const schema = v.number()

stepBench('number', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(42),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['number:expected_number'] },
		batch: 100,
		run: () => schema.execute('42'),
	},
])
