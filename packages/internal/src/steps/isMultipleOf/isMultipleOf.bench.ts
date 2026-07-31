import { bigint, createValchecker, isMultipleOf, number } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [bigint, isMultipleOf, number] })
const numeric = v.number()
	.isMultipleOf(5)
// The one step in the bound/divisor family where the operand kind selects a
// different algorithm rather than a different operand: `bigint` is an exact `%`
// remainder, `number` is the floating-point quotient-tolerance path.
const big = v.bigint()
	.isMultipleOf(5n)

stepBench('isMultipleOf', [
	{
		name: 'number-multiple',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => numeric.execute(20),
	},
	{
		// A non-zero remainder, so this cell walks the quotient-tolerance computation
		// that an exact multiple short-circuits past.
		name: 'number-not-multiple',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isMultipleOf:expected_multiple_of'] },
		batch: 100,
		run: () => numeric.execute(21),
	},
	{
		name: 'bigint-multiple',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => big.execute(20n),
	},
])
