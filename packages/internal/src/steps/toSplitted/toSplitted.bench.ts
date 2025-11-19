/**
 * Benchmark plan for toSplitted:
 * - Operations benchmarked: toSplitted validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, string, toSplitted } from '../..'

const v = createValchecker({ steps: [string, toSplitted] })

describe('toSplitted benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.string()
				.toSplitted(',')
				.execute('a,b,c')
		})

		bench('valid input - large', () => {
			v.string()
				.toSplitted(',')
				.execute('x'.repeat(1000).split('')
					.join(','))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.string()
				.toSplitted(',')
				.execute(123)
		})
	})
})
