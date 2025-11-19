/**
 * Benchmark plan for generic:
 * - Operations benchmarked: generic validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, generic, string } from '../..'

const v = createValchecker({ steps: [generic, string] })

describe('generic benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.generic<{ output: string }>(() => v.string()).execute('test')
		})

		bench('valid input - large', () => {
			v.generic<{ output: string }>(() => v.string()).execute('a'.repeat(1000))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.generic<{ output: string }>(() => v.string()).execute(123)
		})
	})
})
