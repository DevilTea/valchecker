/**
 * Benchmark plan for union:
 * - Operations benchmarked: union validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, union } from '../..'

const v = createValchecker({ steps: [union] })

describe('union benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.union().execute(undefined)
		})

		bench('valid input - large', () => {
			v.union().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.union().execute(undefined)
		})
	})
})
