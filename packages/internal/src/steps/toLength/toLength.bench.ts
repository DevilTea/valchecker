/**
 * Benchmark plan for toLength:
 * - Operations benchmarked: toLength validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, toLength } from '../..'

const v = createValchecker({ steps: [toLength] })

describe('toLength benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.toLength().execute(undefined)
		})

		bench('valid input - large', () => {
			v.toLength().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.toLength().execute(undefined)
		})
	})
})
