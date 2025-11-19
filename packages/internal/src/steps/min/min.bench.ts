/**
 * Benchmark plan for min:
 * - Operations benchmarked: min validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, min, number } from '../..'

const v = createValchecker({ steps: [min, number] })

describe('min benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.number()
				.min(0)
				.execute(5)
		})

		bench('valid input - large', () => {
			v.number()
				.min(0)
				.execute(1000000)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.number()
				.min(0)
				.execute(-1)
		})
	})
})
