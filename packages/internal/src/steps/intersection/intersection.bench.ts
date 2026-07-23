import { bench, describe } from 'vitest'
import { createValchecker, intersection, isLengthAtLeast, string } from '../..'

const v = createValchecker({ steps: [intersection, string, isLengthAtLeast] })
const schema = v.intersection([
	v.string(),
	v.string()
		.isLengthAtLeast(5),
])

describe('intersection benchmarks', () => {
	bench('valid input - small', () => {
		schema.execute('hello')
	})

	bench('valid input - large', () => {
		schema.execute('a'.repeat(1000))
	})

	bench('invalid input', () => {
		schema.execute('hi')
	})
})
