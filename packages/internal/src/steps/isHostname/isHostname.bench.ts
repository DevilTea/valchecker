import { bench, describe } from 'vitest'
import { createValchecker, isHostname, string } from '../..'

const schema = createValchecker({ steps: [string, isHostname] })
	.string()
	.isHostname()

describe('isHostname benchmarks', () => {
	bench('valid input', () => {
		schema.execute('example.com')
	})

	bench('invalid input', () => {
		schema.execute('-bad.com')
	})
})
