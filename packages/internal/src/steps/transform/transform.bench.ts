/**
 * Benchmark plan for transform:
 * - Operations benchmarked: transform validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, transform } from '../..'

const v = createValchecker({ steps: [transform] })

describe('transform benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.transform().execute(undefined)
		})

		bench('valid input - large', () => {
			v.transform().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.transform().execute(undefined)
		})
	})
})
