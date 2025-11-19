/**
 * Benchmark plan for toTrimmedStart:
 * - Operations benchmarked: toTrimmedStart validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, string, toTrimmedStart } from '../..'

const v = createValchecker({ steps: [string, toTrimmedStart] })

describe('toTrimmedStart benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.string()
				.toTrimmedStart()
				.execute('  hello')
		})

		bench('valid input - large', () => {
			v.string()
				.toTrimmedStart()
				.execute(`  ${'x'.repeat(1000)}`)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.string()
				.toTrimmedStart()
				.execute(123)
		})
	})
})
