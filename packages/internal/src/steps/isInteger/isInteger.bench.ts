import { bench, describe } from 'vitest'
import { createValchecker, isInteger, number } from '../..'

const schema = createValchecker({ steps: [number, isInteger] })
	.number()
	.isInteger()

describe('isInteger benchmarks', () => {
	bench('integer', () => {
		schema.execute(42)
	})

	bench('non-integer', () => {
		schema.execute(1.5)
	})
})
