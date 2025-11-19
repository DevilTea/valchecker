/**
 * Benchmark plan for fallback:
 * - Operations benchmarked: fallback validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, fallback } from '../..'

const v = createValchecker({ steps: [fallback] })

describe('fallback benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.fallback().execute(undefined)
		})

		bench('valid input - large', () => {
			v.fallback().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.fallback().execute(undefined)
		})
	})
})
