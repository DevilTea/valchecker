/**
 * Benchmark plan for toSliced:
 * - Operations benchmarked: toSliced validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { any, array, createValchecker, toSliced } from '../..'

const v = createValchecker({ steps: [toSliced, array, any] })

describe('toSliced benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.array(v.any())
				.toSliced(0, 2)
				.execute([1, 2, 3, 4])
		})

		bench('valid input - large', () => {
			v.array(v.any())
				.toSliced(0, 100)
				.execute(Array.from({ length: 1000 }, (_, i) => i))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.array(v.any())
				.toSliced(0, 2)
				.execute('string')
		})
	})
})
