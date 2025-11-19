/**
 * Benchmark plan for fallback:
 * - Operations benchmarked: fallback validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, fallback, string } from '../..'

const v = createValchecker({ steps: [fallback, string] })

describe('fallback benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.string()
				.fallback(() => 'default')
				.execute('valid')
		})

		bench('valid input - large', () => {
			v.string()
				.fallback(() => 'default')
				.execute('a'.repeat(1000))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.string()
				.fallback(() => 'default')
				.execute(123)
		})
	})
})
