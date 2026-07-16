import { bench, describe } from 'vitest'
import { createValchecker, isFinite, number } from '../..'

const schema = createValchecker({ steps: [number, isFinite] }).number().isFinite()

describe('isFinite benchmarks', () => {
	bench('finite number', () => {
		schema.execute(42)
	})

	bench('infinite number', () => {
		schema.execute(Infinity)
	})
})