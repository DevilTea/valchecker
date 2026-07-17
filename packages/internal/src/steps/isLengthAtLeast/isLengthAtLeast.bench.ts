import { bench, describe } from 'vitest'
import { createValchecker, isLengthAtLeast, string } from '../..'

const schema = createValchecker({ steps: [string, isLengthAtLeast] }).string().isLengthAtLeast(3)

describe('isLengthAtLeast benchmarks', () => {
	bench('length success', () => {
		schema.execute('value')
	})

	bench('length failure', () => {
		schema.execute('hi')
	})
})
