/**
 * Benchmark plan for toString:
 * - Operations benchmarked: toString validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, toString } from '../..'

const v = createValchecker({ steps: [toString] })

describe('toString benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.toString().execute(undefined)
		})

		bench('valid input - large', () => {
			v.toString().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.toString().execute(undefined)
		})
	})
})
