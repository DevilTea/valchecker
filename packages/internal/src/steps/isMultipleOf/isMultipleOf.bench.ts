import { bigint, createValchecker, isMultipleOf, number } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [bigint, isMultipleOf, number] })
const numeric = v.number()
	.isMultipleOf(0.01)
// The one step in the bound/divisor family where the operand kind selects a
// different algorithm rather than a different operand: `bigint` is an exact `%`
// remainder, while the number cells deliberately exercise the reconstructed-multiple
// floating-point tolerance path rather than the exact-remainder short circuit.
const big = v.bigint()
	.isMultipleOf(5n)

stepBench('isMultipleOf', [
	{
		name: 'number-multiple',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => numeric.execute(8192.04),
	},
	{
		// A nearby but ordinary non-multiple on the same inexact path.
		name: 'number-not-multiple',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isMultipleOf:expected_multiple_of'] },
		batch: 100,
		run: () => numeric.execute(8192.041),
	},
	{
		name: 'bigint-multiple',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => big.execute(20n),
	},
])
