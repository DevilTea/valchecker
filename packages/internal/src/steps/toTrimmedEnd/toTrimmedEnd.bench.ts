/**
 * Benchmark plan for toTrimmedEnd:
 * - Operations benchmarked: toTrimmedEnd validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, string, toTrimmedEnd } from '../..'

const v = createValchecker({ steps: [string, toTrimmedEnd] })

describe('toTrimmedEnd benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.string()
				.toTrimmedEnd()
				.execute('hello  ')
		})

		bench('valid input - large', () => {
			v.string()
				.toTrimmedEnd()
				.execute(`${'x'.repeat(1000)}  `)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.string()
				.toTrimmedEnd()
				.execute(123)
		})
	})
})
