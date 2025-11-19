/**
 * Benchmark plan for undefined:
 * - Operations benchmarked: undefined validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, undefined_ } from '../..'

const v = createValchecker({ steps: [undefined_] })

describe('undefined benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.undefined().execute(undefined)
		})

		bench('valid input - large', () => {
			v.undefined().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.undefined().execute(null)
		})
	})
})
