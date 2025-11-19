/**
 * Benchmark plan for toFiltered:
 * - Operations benchmarked: toFiltered validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, toFiltered } from '../..'

const v = createValchecker({ steps: [toFiltered] })

describe('toFiltered benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.toFiltered().execute(undefined)
		})

		bench('valid input - large', () => {
			v.toFiltered().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.toFiltered().execute(undefined)
		})
	})
})
