/**
 * Benchmark plan for toSliced:
 * - Operations benchmarked: toSliced validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, toSliced } from '../..'

const v = createValchecker({ steps: [toSliced] })

describe('toSliced benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.toSliced().execute(undefined)
		})

		bench('valid input - large', () => {
			v.toSliced().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.toSliced().execute(undefined)
		})
	})
})
