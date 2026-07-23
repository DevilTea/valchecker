import { bench, describe } from 'vitest'
import { createValchecker, isAtMost, number } from '../..'

const schema = createValchecker({ steps: [number, isAtMost] })
	.number()
	.isAtMost(100)

describe('isAtMost benchmarks', () => {
	bench('numeric success', () => {
		schema.execute(5)
	})

	bench('numeric failure', () => {
		schema.execute(101)
	})
})
