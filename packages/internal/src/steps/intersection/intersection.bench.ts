/**
 * Benchmark plan for intersection:
 * - Operations benchmarked: intersection validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, intersection, min, string } from '../..'

const v = createValchecker({ steps: [intersection, string, min] })

describe('intersection benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.intersection([v.string(), v.string().min(5)]).execute('hello')
		})

		bench('valid input - large', () => {
			v.intersection([v.string(), v.string().min(5)]).execute('a'.repeat(1000))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.intersection([v.string(), v.string().min(5)]).execute('hi')
		})
	})
})
