/**
 * Benchmark plan for toUppercase:
 * - Operations benchmarked: toUppercase validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, string, toUppercase } from '../..'

const v = createValchecker({ steps: [string, toUppercase] })

describe('toUppercase benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.string()
				.toUppercase()
				.execute('hello')
		})

		bench('valid input - large', () => {
			v.string()
				.toUppercase()
				.execute('x'.repeat(1000))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.string()
				.toUppercase()
				.execute(123)
		})
	})
})
