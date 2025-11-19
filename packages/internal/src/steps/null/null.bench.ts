/**
 * Benchmark plan for null:
 * - Operations benchmarked: null validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, null_ } from '../..'

const v = createValchecker({ steps: [null_] })

describe('null benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.null()
				.execute(null)
		})

		bench('valid input - large', () => {
			v.null()
				.execute(null)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.null()
				.execute(undefined)
		})
	})
})
