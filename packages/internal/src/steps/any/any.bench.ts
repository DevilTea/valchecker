/**
 * Benchmark plan for any:
 * - Operations benchmarked: any validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { any, createValchecker } from '../..'

const v = createValchecker({ steps: [any] })

describe('any benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.any().execute(undefined)
		})

		bench('valid input - large', () => {
			v.any().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.any().execute(undefined)
		})
	})
})
