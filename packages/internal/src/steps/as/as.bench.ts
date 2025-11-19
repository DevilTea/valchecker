/**
 * Benchmark plan for as:
 * - Operations benchmarked: as validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { as, createValchecker } from '../..'

const v = createValchecker({ steps: [as] })

describe('as benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.as()
				.execute(undefined)
		})

		bench('valid input - large', () => {
			v.as()
				.execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.as()
				.execute(undefined)
		})
	})
})
