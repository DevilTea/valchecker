/**
 * Benchmark plan for literal:
 * - Operations benchmarked: literal validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, literal } from '../..'

const v = createValchecker({ steps: [literal] })

describe('literal benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.literal().execute(undefined)
		})

		bench('valid input - large', () => {
			v.literal().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.literal().execute(undefined)
		})
	})
})
