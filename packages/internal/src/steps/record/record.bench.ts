/**
 * Benchmark plan for record:
 * - Operations benchmarked: schema construction and object entry execution
 * - Input scenarios: small/large open-domain success, recoverable failure, finite exhaustive
 * - Comparison baseline: native object copy
 */

import { bench, describe } from 'vitest'
import { createValchecker, literal, number, record, string, union } from '../..'

const v = createValchecker({ steps: [record, literal, number, string, union] })
const open = v.record({ key: v.string(), value: v.number() })
const finite = v.record({ key: v.union(['a', 'b', 'c']), value: v.number() })
const small = { a: 1, b: 2, c: 3 }
const large = Object.fromEntries(Array.from({ length: 1000 }, (_, index) => [`key-${index}`, index]))

describe('record benchmarks', () => {
	describe('schema construction', () => {
		bench('construct open record schema', () => {
			v.record({ key: v.string(), value: v.number() })
		})
		bench('construct finite record schema', () => {
			v.record({ key: v.union(['a', 'b', 'c']), value: v.number() })
		})
	})

	describe('execution', () => {
		bench('open - small', () => {
			open.execute(small)
		})
		bench('open - large', () => {
			open.execute(large)
		})
		bench('open - recoverable value failure', () => {
			open.execute({ a: 1, b: 'x' })
		})
		bench('finite - exhaustive success', () => {
			finite.execute(small)
		})
	})

	describe('baseline', () => {
		bench('native object copy', () => {
			void { ...small }
		})
	})
})
