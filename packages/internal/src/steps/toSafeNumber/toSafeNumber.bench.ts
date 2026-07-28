import { bigint, createValchecker, toSafeNumber } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [bigint, toSafeNumber] })
const schema = v.bigint()
	.toSafeNumber()
// Hoisted: the bigint arithmetic is fixture setup, not the measured conversion.
const outOfRange = BigInt(Number.MAX_SAFE_INTEGER) + 1n

stepBench('toSafeNumber', [
	{
		name: 'safe-bigint',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute(42n),
	},
	{
		name: 'out-of-safe-integer-range',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['toSafeNumber:out_of_safe_integer_range'] },
		batch: 100,
		run: () => schema.execute(outOfRange),
	},
])
