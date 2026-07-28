import { bigint, createValchecker } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [bigint] })
const schema = v.bigint()
const valid = 1n

stepBench('bigint', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(valid),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['bigint:expected_bigint'] },
		batch: 100,
		run: () => schema.execute(1),
	},
])
