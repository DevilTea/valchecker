import { bench, describe } from 'vitest'
import { createValchecker, isNaN, number } from '../..'

const schema = createValchecker({ steps: [number, isNaN] }).number().isNaN()

describe('isNaN benchmarks', () => {
	bench('NaN', () => {
		schema.execute(Number.NaN)
	})

	bench('ordinary number', () => {
		schema.execute(42)
	})
})