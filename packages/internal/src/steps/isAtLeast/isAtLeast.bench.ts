import { bench, describe } from 'vitest'
import { createValchecker, isAtLeast, number } from '../..'

const schema = createValchecker({ steps: [number, isAtLeast] }).number().isAtLeast(0)

describe('isAtLeast benchmarks', () => {
	bench('numeric success', () => {
		schema.execute(5)
	})

	bench('numeric failure', () => {
		schema.execute(-1)
	})
})
