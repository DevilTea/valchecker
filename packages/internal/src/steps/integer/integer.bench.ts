/**
 * Benchmark plan for integer:
 * - Operations benchmarked: integer validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, integer, number } from '../..'

const v = createValchecker({ steps: [integer, number] })

describe('integer benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.number()
				.integer()
				.execute(5)
		})

		bench('valid input - large', () => {
			v.number()
				.integer()
				.execute(1000000)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.number()
				.integer()
				.execute(5.5)
		})
	})
})
