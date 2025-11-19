/**
 * Benchmark plan for toLength:
 * - Operations benchmarked: toLength validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { any, array, createValchecker, toLength } from '../..'

const v = createValchecker({ steps: [toLength, array, any] })

describe('toLength benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.array(v.any())
				.toLength()
				.execute([1, 2, 3])
		})

		bench('valid input - large', () => {
			v.array(v.any())
				.toLength()
				.execute(Array.from({ length: 1000 }, (_, i) => i))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.array(v.any())
				.toLength()
				.execute('string')
		})
	})
})
