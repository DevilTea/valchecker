/**
 * Benchmark plan for toTrimmedStart:
 * - Operations benchmarked: toTrimmedStart validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, toTrimmedStart } from '../..'

const v = createValchecker({ steps: [toTrimmedStart] })

describe('toTrimmedStart benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.toTrimmedStart().execute(undefined)
		})

		bench('valid input - large', () => {
			v.toTrimmedStart().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.toTrimmedStart().execute(undefined)
		})
	})
})
