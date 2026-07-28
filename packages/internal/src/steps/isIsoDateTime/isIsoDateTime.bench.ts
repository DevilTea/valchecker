import { createValchecker, isIsoDateTime, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isIsoDateTime] })
const schema = v.string()
	.isIsoDateTime()

stepBench('isIsoDateTime', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('2026-07-23T12:30:00Z'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isIsoDateTime:expected_iso_date_time'] },
		batch: 100,
		run: () => schema.execute('2026-02-30T12:00:00'),
	},
])
