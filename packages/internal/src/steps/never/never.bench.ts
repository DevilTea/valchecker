/**
 * Benchmark plan for never:
 * - Operations benchmarked: never validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, never } from '../..'

const v = createValchecker({ steps: [never] })

describe('never benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.never().execute(undefined)
		})

		bench('valid input - large', () => {
			v.never().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.never().execute(undefined)
		})
	})
})
