/**
 * Benchmark plan for transform:
 * - Operations benchmarked: transform validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, string, transform } from '../..'

const v = createValchecker({ steps: [string, transform] })

describe('transform benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.string()
				.transform(x => x)
				.execute('hello')
		})

		bench('valid input - large', () => {
			v.string()
				.transform(x => x)
				.execute('x'.repeat(1000))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.string()
				.transform(x => x)
				.execute(123)
		})
	})
})
