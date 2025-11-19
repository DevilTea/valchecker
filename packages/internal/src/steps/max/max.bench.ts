/**
 * Benchmark plan for max:
 * - Operations benchmarked: max validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, max, number } from '../..'

const v = createValchecker({ steps: [max, number] })

describe('max benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.number()
				.max(10)
				.execute(5)
		})

		bench('valid input - large', () => {
			v.number()
				.max(1000000)
				.execute(1000000)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.number()
				.max(10)
				.execute(15)
		})
	})
})
