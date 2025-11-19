/**
 * Benchmark plan for toSorted:
 * - Operations benchmarked: toSorted validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { any, array, createValchecker, toSorted } from '../..'

const v = createValchecker({ steps: [toSorted, array, any] })

describe('toSorted benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.array(v.any())
				.toSorted()
				.execute([3, 1, 2])
		})

		bench('valid input - large', () => {
			v.array(v.any())
				.toSorted()
				.execute(Array.from({ length: 1000 }, (_, i) => 1000 - i))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.array(v.any())
				.toSorted()
				.execute('string')
		})
	})
})
