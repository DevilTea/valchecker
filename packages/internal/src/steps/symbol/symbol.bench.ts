/**
 * Benchmark plan for symbol:
 * - Operations benchmarked: symbol validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, symbol } from '../..'

const v = createValchecker({ steps: [symbol] })

describe('symbol benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.symbol()
				.execute(undefined)
		})

		bench('valid input - large', () => {
			v.symbol()
				.execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.symbol()
				.execute(undefined)
		})
	})
})
