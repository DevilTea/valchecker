/**
 * Benchmark plan for toFiltered:
 * - Operations benchmarked: toFiltered validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { any, array, createValchecker, toFiltered } from '../..'

const v = createValchecker({ steps: [toFiltered, array, any] })

describe('toFiltered benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.array(v.any())
				.toFiltered(() => true)
				.execute([1, 2, 3])
		})

		bench('valid input - large', () => {
			v.array(v.any())
				.toFiltered(() => true)
				.execute(Array.from({ length: 1000 }, (_, i) => i))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.array(v.any())
				.toFiltered(() => true)
				.execute('string')
		})
	})
})
