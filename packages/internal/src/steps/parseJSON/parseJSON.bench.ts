/**
 * Benchmark plan for parseJSON:
 * - Operations benchmarked: parseJSON validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, parseJSON, string } from '../..'

const v = createValchecker({ steps: [parseJSON, string] })

describe('parseJSON benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.string()
				.parseJSON()
				.execute('{}')
		})

		bench('valid input - large', () => {
			v.string()
				.parseJSON()
				.execute(JSON.stringify({ large: 'a'.repeat(1000) }))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.string()
				.parseJSON()
				.execute('invalid json')
		})
	})
})
