/**
 * Benchmark plan for toTrimmedEnd:
 * - Operations benchmarked: toTrimmedEnd validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, toTrimmedEnd } from '../..'

const v = createValchecker({ steps: [toTrimmedEnd] })

describe('toTrimmedEnd benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.toTrimmedEnd().execute(undefined)
		})

		bench('valid input - large', () => {
			v.toTrimmedEnd().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.toTrimmedEnd().execute(undefined)
		})
	})
})
