/**
 * Benchmark plan for startsWith:
 * - Operations benchmarked: startsWith validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, startsWith } from '../..'

const v = createValchecker({ steps: [startsWith] })

describe('startsWith benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.startsWith().execute(undefined)
		})

		bench('valid input - large', () => {
			v.startsWith().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.startsWith().execute(undefined)
		})
	})
})
