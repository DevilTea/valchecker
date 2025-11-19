/**
 * Benchmark plan for number:
 * - Operations benchmarked: number validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, number } from '../..'

const v = createValchecker({ steps: [number] })

describe('number benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.number().execute(123)
		})

		bench('valid input - large', () => {
			v.number().execute(Number.MAX_SAFE_INTEGER)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.number().execute('123')
		})
	})

	describe('baselines', () => {
		bench('native typeof check', () => {
			// eslint-disable-next-line ts/no-unused-expressions
			typeof 123 === 'number'
		})
	})
})
