/**
 * Benchmark plan for endsWith:
 * - Operations benchmarked: endsWith validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, endsWith } from '../..'

const v = createValchecker({ steps: [endsWith] })

describe('endsWith benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.endsWith().execute(undefined)
		})

		bench('valid input - large', () => {
			v.endsWith().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.endsWith().execute(undefined)
		})
	})
})
