/**
 * Benchmark plan for union:
 * - Operations benchmarked: schema construction and execution
 * - Input scenarios: first/later branch success and all-branch failure
 * - Comparison baseline: shorthand branches versus their explicit provider schemas
 */

import { bench, describe } from 'vitest'
import { createValchecker, literal, null_, number, string, undefined_, union } from '../..'

const v = createValchecker({
	steps: [literal, null_, number, string, undefined_, union],
})

const schemaUnion = v.union([v.string(), v.number()])
const shorthandUnion = v.union(['auto', null, undefined, v.number()])
const explicitUnion = v.union([
	v.literal('auto'),
	v.null(),
	v.undefined(),
	v.number(),
])

describe('union benchmarks', () => {
	describe('schema construction', () => {
		bench('shorthand branches', () => {
			v.union(['auto', null, undefined, v.number()])
		})

		bench('explicit provider schemas', () => {
			v.union([
				v.literal('auto'),
				v.null(),
				v.undefined(),
				v.number(),
			])
		})
	})

	describe('schema branches', () => {
		bench('first branch success', () => {
			schemaUnion.execute('hello')
		})

		bench('later branch success', () => {
			schemaUnion.execute(123456789)
		})

		bench('all branches fail', () => {
			schemaUnion.execute(true)
		})
	})

	describe('shorthand execution equivalence', () => {
		bench('shorthand first branch success', () => {
			shorthandUnion.execute('auto')
		})

		bench('explicit first branch success', () => {
			explicitUnion.execute('auto')
		})

		bench('shorthand later branch success', () => {
			shorthandUnion.execute(42)
		})

		bench('explicit later branch success', () => {
			explicitUnion.execute(42)
		})

		bench('shorthand all branches fail', () => {
			shorthandUnion.execute(false)
		})

		bench('explicit all branches fail', () => {
			explicitUnion.execute(false)
		})
	})
})
