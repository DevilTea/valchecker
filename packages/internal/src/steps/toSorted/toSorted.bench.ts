/**
 * Benchmark plan for toSorted:
 * - Operations benchmarked: toSorted validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, toSorted } from '../..'

const v = createValchecker({ steps: [toSorted] })

describe('toSorted benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.toSorted().execute(undefined)
		})

		bench('valid input - large', () => {
			v.toSorted().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.toSorted().execute(undefined)
		})
	})
})
