/**
 * Benchmark plan for unknown:
 * - Operations benchmarked: unknown validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, unknown } from '../..'

const v = createValchecker({ steps: [unknown] })

describe('unknown benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.unknown()
				.execute(undefined)
		})

		bench('valid input - large', () => {
			v.unknown()
				.execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.unknown()
				.execute(undefined)
		})
	})
})
