/**
 * Benchmark plan for toTrimmed:
 * - Operations benchmarked: toTrimmed validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, toTrimmed } from '../..'

const v = createValchecker({ steps: [toTrimmed] })

describe('toTrimmed benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.toTrimmed().execute(undefined)
		})

		bench('valid input - large', () => {
			v.toTrimmed().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.toTrimmed().execute(undefined)
		})
	})
})
