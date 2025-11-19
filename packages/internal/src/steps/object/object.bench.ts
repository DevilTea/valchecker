/**
 * Benchmark plan for object:
 * - Operations benchmarked: object validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, object } from '../..'

const v = createValchecker({ steps: [object] })

describe('object benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.object({}).execute({ a: 1 })
		})

		bench('valid input - large', () => {
			v.object({}).execute(Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i, i])))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.object({}).execute(null)
		})
	})
})
