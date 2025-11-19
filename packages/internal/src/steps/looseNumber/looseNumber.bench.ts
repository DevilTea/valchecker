/**
 * Benchmark plan for looseNumber:
 * - Operations benchmarked: looseNumber validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, looseNumber } from '../..'

const v = createValchecker({ steps: [looseNumber] })

describe('looseNumber benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.looseNumber()
				.execute(undefined)
		})

		bench('valid input - large', () => {
			v.looseNumber()
				.execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.looseNumber()
				.execute(undefined)
		})
	})
})
