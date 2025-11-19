/**
 * Benchmark plan for toLowercase:
 * - Operations benchmarked: toLowercase validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, string, toLowercase } from '../..'

const v = createValchecker({ steps: [toLowercase, string] })

describe('toLowercase benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.string()
				.toLowercase()
				.execute('HELLO')
		})

		bench('valid input - large', () => {
			v.string()
				.toLowercase()
				.execute('A'.repeat(1000))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.string()
				.toLowercase()
				.execute(123)
		})
	})
})
