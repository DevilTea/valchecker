import { createValchecker, isUuid, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isUuid] })
const schema = v.string()
	.isUuid()

stepBench('isUuid', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('123e4567-e89b-12d3-a456-426614174000'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isUuid:expected_uuid'] },
		batch: 100,
		run: () => schema.execute('123e4567-e89b-12d3-a456-42661417400'),
	},
])
