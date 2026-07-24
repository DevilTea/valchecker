import { bench, describe } from 'vitest'
import { createValchecker, isJwt, string } from '../..'

const schema = createValchecker({ steps: [string, isJwt] })
	.string()
	.isJwt()

describe('isJwt benchmarks', () => {
	bench('valid input', () => {
		schema.execute('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')
	})

	bench('invalid input', () => {
		schema.execute('abc.def')
	})
})
