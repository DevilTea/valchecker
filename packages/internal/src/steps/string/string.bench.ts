/**
 * Benchmark plan for string:
 * - Operations benchmarked: string validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, string } from '../..'

const v = createValchecker({ steps: [string] })

describe('string benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.string().execute('hello')
		})

		bench('valid input - large', () => {
			v.string().execute('x'.repeat(1000))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.string().execute(123)
		})
	})

	describe('baselines', () => {
		bench('native typeof check', () => {
			// eslint-disable-next-line ts/no-unused-expressions
			typeof 'hello' === 'string'
		})
	})
})
