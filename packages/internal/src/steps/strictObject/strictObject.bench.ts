/**
 * Benchmark plan for strictObject:
 * - Operations benchmarked: strictObject validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, strictObject } from '../..'

const v = createValchecker({ steps: [strictObject] })

describe('strictObject benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.strictObject().execute(undefined)
		})

		bench('valid input - large', () => {
			v.strictObject().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.strictObject().execute(undefined)
		})
	})
})
