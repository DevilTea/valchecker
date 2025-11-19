/**
 * Benchmark plan for array:
 * - Operations benchmarked: array validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { array, createValchecker } from '../..'

const v = createValchecker({ steps: [array] })

describe('array benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.array().execute([1, 2, 3])
		})

		bench('valid input - large', () => {
			v.array().execute(Array.from({ length: 1000 }, (_, i) => i))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.array().execute('[]')
		})
	})

	describe('baselines', () => {
		bench('native Array.isArray', () => {
			Array.isArray([1, 2, 3])
		})
	})
})
