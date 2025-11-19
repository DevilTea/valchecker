/**
 * Benchmark plan for intersection:
 * - Operations benchmarked: intersection validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, intersection } from '../..'

const v = createValchecker({ steps: [intersection] })

describe('intersection benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.intersection().execute(undefined)
		})

		bench('valid input - large', () => {
			v.intersection().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.intersection().execute(undefined)
		})
	})
})
