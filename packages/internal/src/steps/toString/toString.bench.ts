/**
 * Benchmark plan for toString:
 * - Operations benchmarked: toString validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, number, toString } from '../..'

const v = createValchecker({ steps: [number, toString] })

describe('toString benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.number()
				.toString()
				.execute(123)
		})

		bench('valid input - large', () => {
			v.number()
				.toString()
				.execute(123456789)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.number()
				.toString()
				.execute('already string')
		})
	})
})
