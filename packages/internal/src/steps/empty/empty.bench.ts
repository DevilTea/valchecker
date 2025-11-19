/**
 * Benchmark plan for empty:
 * - Operations benchmarked: empty validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, empty, string } from '../..'

const v = createValchecker({ steps: [empty, string] })

describe('empty benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.string()
				.empty()
				.execute('')
		})

		bench('valid input - large', () => {
			v.string()
				.empty()
				.execute('')
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.string()
				.empty()
				.execute('not empty')
		})
	})
})
