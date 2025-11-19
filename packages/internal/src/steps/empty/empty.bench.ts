/**
 * Benchmark plan for empty:
 * - Operations benchmarked: empty validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, empty } from '../..'

const v = createValchecker({ steps: [empty] })

describe('empty benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.empty().execute(undefined)
		})

		bench('valid input - large', () => {
			v.empty().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.empty().execute(undefined)
		})
	})
})
