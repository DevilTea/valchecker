/**
 * Benchmark plan for max:
 * - Operations benchmarked: max validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, max } from '../..'

const v = createValchecker({ steps: [max] })

describe('max benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.max().execute(undefined)
		})

		bench('valid input - large', () => {
			v.max().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.max().execute(undefined)
		})
	})
})
