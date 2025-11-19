/**
 * Benchmark plan for toSplitted:
 * - Operations benchmarked: toSplitted validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, toSplitted } from '../..'

const v = createValchecker({ steps: [toSplitted] })

describe('toSplitted benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.toSplitted().execute(undefined)
		})

		bench('valid input - large', () => {
			v.toSplitted().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.toSplitted().execute(undefined)
		})
	})
})
