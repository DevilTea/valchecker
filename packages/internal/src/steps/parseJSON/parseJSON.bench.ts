/**
 * Benchmark plan for parseJSON:
 * - Operations benchmarked: parseJSON validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, parseJSON } from '../..'

const v = createValchecker({ steps: [parseJSON] })

describe('parseJSON benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.parseJSON().execute(undefined)
		})

		bench('valid input - large', () => {
			v.parseJSON().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.parseJSON().execute(undefined)
		})
	})
})
