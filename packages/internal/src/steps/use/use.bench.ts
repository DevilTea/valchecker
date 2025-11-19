/**
 * Benchmark plan for use:
 * - Operations benchmarked: use validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, string, use } from '../..'

const v = createValchecker({ steps: [string, use] })

describe('use benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.use(v.string()).execute('hello')
		})

		bench('valid input - large', () => {
			v.use(v.string()).execute('x'.repeat(1000))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.use(v.string()).execute(123)
		})
	})
})
