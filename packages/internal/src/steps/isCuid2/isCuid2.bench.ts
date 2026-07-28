import { createValchecker, isCuid2, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isCuid2] })
const schema = v.string()
	.isCuid2()

stepBench('isCuid2', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('tz4a98xxat96iws9zmbrgj3a'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isCuid2:expected_cuid2'] },
		batch: 100,
		run: () => schema.execute('TZ4A98XXAT96IWS9ZMBRGJ3A'),
	},
])
