import { createValchecker, string, toMappedBoolean } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, toMappedBoolean] })
// The mapping is a schema-time operand: it is snapshotted and turned into two sets while
// the schema is built, so it belongs above the cells rather than inside a `run`.
const schema = v.string()
	.toMappedBoolean({
		trueValues: ['Y', 'yes'],
		falseValues: ['N', 'no'],
	})

stepBench('toMappedBoolean', [
	{
		name: 'mapped-value',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute('yes'),
	},
	{
		name: 'unmapped-value',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['toMappedBoolean:unmapped_value'] },
		batch: 50,
		run: () => schema.execute('unknown'),
	},
])
