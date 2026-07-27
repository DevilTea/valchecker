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

	// Segments are validated by length and alphabet, so a rejection by length is
	// far cheaper than one by alphabet, and a wrong segment count is cheaper than
	// either.
	bench('invalid segment length', () => {
		schema.execute('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig01')
	})

	bench('invalid segment alphabet', () => {
		schema.execute('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.b@d')
	})
})
