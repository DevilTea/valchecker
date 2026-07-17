import { bench, describe } from 'vitest'
import { bigint, createValchecker, toSafeNumber } from '../..'

const schema = createValchecker({ steps: [bigint, toSafeNumber] })
	.bigint()
	.toSafeNumber()

describe('toSafeNumber benchmarks', () => {
	bench('safe bigint', () => {
		schema.execute(42n)
	})

	bench('maximum safe bigint', () => {
		schema.execute(BigInt(Number.MAX_SAFE_INTEGER))
	})

	bench('out-of-range bigint', () => {
		schema.execute(BigInt(Number.MAX_SAFE_INTEGER) + 1n)
	})
})
