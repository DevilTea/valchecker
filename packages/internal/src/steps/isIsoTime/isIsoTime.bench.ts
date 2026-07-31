import { createValchecker, isIsoTime, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isIsoTime] })
const schema = v.string()
	.isIsoTime()

stepBench('isIsoTime', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('12:30:45'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isIsoTime:expected_iso_time'] },
		batch: 100,
		run: () => schema.execute('24:00:00'),
	},
])
