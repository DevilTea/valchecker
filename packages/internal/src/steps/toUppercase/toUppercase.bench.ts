/**
 * Benchmark plan for toUppercase:
 * - Operations benchmarked: toUppercase validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, toUppercase } from '../..'

const v = createValchecker({ steps: [toUppercase] })

describe('toUppercase benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.toUppercase().execute(undefined)
		})

		bench('valid input - large', () => {
			v.toUppercase().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.toUppercase().execute(undefined)
		})
	})
})
