import { boolean, createValchecker } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [boolean] })
const schema = v.boolean()

stepBench('boolean', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(true),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['boolean:expected_boolean'] },
		batch: 100,
		run: () => schema.execute('true'),
	},
])
