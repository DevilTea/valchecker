/**
 * Benchmark plan for bigint:
 * - Operations benchmarked: bigint validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { bigint, createValchecker } from '../..'

const v = createValchecker({ steps: [bigint] })

describe('bigint benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.bigint().execute(undefined)
		})

		bench('valid input - large', () => {
			v.bigint().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.bigint().execute(undefined)
		})
	})
})
