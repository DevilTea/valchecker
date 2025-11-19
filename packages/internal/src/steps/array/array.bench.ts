/**
 * Benchmark plan for array:
 * - Operations benchmarked: array validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { any, array, createValchecker } from '../..'

const v = createValchecker({ steps: [any, array] })

describe('array benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.array(v.any())
				.execute([1, 2, 3])
		})

		bench('valid input - large', () => {
			v.array(v.any())
				.execute(Array.from({ length: 1000 }, (_, i) => i))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.array(v.any())
				.execute('[]')
		})
	})

	describe('baselines', () => {
		bench('native Array.isArray', () => {
			Array.isArray([1, 2, 3])
		})
	})
})
