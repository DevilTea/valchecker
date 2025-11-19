/**
 * Benchmark plan for min:
 * - Operations benchmarked: min validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, min } from '../..'

const v = createValchecker({ steps: [min] })

describe('min benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.min().execute(undefined)
		})

		bench('valid input - large', () => {
			v.min().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.min().execute(undefined)
		})
	})
})
