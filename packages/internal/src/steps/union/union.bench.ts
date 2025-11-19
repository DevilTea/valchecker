/**
 * Benchmark plan for union:
 * - Operations benchmarked: union validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, number, string, union } from '../..'

const v = createValchecker({ steps: [number, string, union] })

describe('union benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.union([v.string(), v.number()]).execute('hello')
		})

		bench('valid input - large', () => {
			v.union([v.string(), v.number()]).execute(123456789)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.union([v.string(), v.number()]).execute(true)
		})
	})
})
