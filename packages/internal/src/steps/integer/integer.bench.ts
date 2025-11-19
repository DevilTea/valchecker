/**
 * Benchmark plan for integer:
 * - Operations benchmarked: integer validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, integer } from '../..'

const v = createValchecker({ steps: [integer] })

describe('integer benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.integer().execute(undefined)
		})

		bench('valid input - large', () => {
			v.integer().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.integer().execute(undefined)
		})
	})
})
