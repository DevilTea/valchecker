import { createValchecker, isUlid, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isUlid] })
const schema = v.string()
	.isUlid()

stepBench('isUlid', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('01ARZ3NDEKTSV4RRFFQ69G5FAV'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isUlid:expected_ulid'] },
		batch: 100,
		run: () => schema.execute('01ARZ3NDEKTSV4RRFFQ69G5FA'),
	},
])
