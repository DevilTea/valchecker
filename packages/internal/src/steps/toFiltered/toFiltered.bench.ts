/**
 * Benchmark plan for toFiltered:
 * - Operations benchmarked: array and Set filtering
 * - Input scenarios: small/large success and callback failure
 * - Comparison baselines: collection traversal cost is represented by the existing transforms
 */

import { bench, describe } from 'vitest'
import { any, array, createValchecker, set, toFiltered } from '../..'

const v = createValchecker({ steps: [toFiltered, array, set, any] })
const arraySmall = v.array(v.any())
	.toFiltered(() => true)
const arrayLarge = v.array(v.any())
	.toFiltered((_item, index) => index % 2 === 0)
const setSmall = v.set(v.any())
	.toFiltered(() => true)
const setLarge = v.set(v.any())
	.toFiltered((_item, index) => index % 2 === 0)
const setFailure = v.set(v.any())
	.toFiltered(() => { throw new Error('x') })
const largeArray = Array.from({ length: 1000 }, (_, index) => index)
const largeSet = new Set(largeArray)

describe('toFiltered benchmarks', () => {
	bench('array success - small', () => {
		arraySmall.execute([1, 2, 3])
	})

	bench('array success - large', () => {
		arrayLarge.execute(largeArray)
	})

	bench('set success - small', () => {
		setSmall.execute(new Set([1, 2, 3]))
	})

	bench('set success - large', () => {
		setLarge.execute(largeSet)
	})

	bench('set callback failure', () => {
		setFailure.execute(new Set([1]))
	})
})
