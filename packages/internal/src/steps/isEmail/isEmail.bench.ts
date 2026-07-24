import { bench, describe } from 'vitest'
import { createValchecker, isEmail, string } from '../..'

const schema = createValchecker({ steps: [string, isEmail] })
	.string()
	.isEmail()

describe('isEmail benchmarks', () => {
	bench('valid input', () => {
		schema.execute('john.doe@example.com')
	})

	bench('invalid input', () => {
		schema.execute('plainaddress')
	})
})
