/**
 * Benchmark plan for json:
 * - Operations benchmarked: json validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, json } from '../..'

const v = createValchecker({ steps: [json] })

describe('json benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.json().execute(undefined)
		})

		bench('valid input - large', () => {
			v.json().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.json().execute(undefined)
		})
	})
})
