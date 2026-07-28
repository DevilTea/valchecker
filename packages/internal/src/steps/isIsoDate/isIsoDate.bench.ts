import { createValchecker, isIsoDate, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isIsoDate] })
const schema = v.string()
	.isIsoDate()

stepBench('isIsoDate', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('2026-07-23'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isIsoDate:expected_iso_date'] },
		batch: 100,
		run: () => schema.execute('2026-02-30'),
	},
])
