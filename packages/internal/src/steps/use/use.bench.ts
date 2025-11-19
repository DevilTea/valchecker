/**
 * Benchmark plan for use:
 * - Operations benchmarked: use validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, use } from '../..'

const v = createValchecker({ steps: [use] })

describe('use benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.use().execute(undefined)
		})

		bench('valid input - large', () => {
			v.use().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.use().execute(undefined)
		})
	})
})
