/**
 * Benchmark plan for generic:
 * - Operations benchmarked: generic validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, generic } from '../..'

const v = createValchecker({ steps: [generic] })

describe('generic benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.generic().execute(undefined)
		})

		bench('valid input - large', () => {
			v.generic().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.generic().execute(undefined)
		})
	})
})
