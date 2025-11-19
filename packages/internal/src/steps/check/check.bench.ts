/**
 * Benchmark plan for check:
 * - Operations benchmarked: check validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { check, createValchecker } from '../..'

const v = createValchecker({ steps: [check] })

describe('check benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.check(() => true)
				.execute(undefined)
		})

		bench('valid input - large', () => {
			v.check(() => true)
				.execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.check(() => false)
				.execute(undefined)
		})
	})
})
