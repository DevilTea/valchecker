import { bench, describe } from 'vitest'
import { createValchecker, isNanoid, string } from '../..'

const schema = createValchecker({ steps: [string, isNanoid] })
	.string()
	.isNanoid()

describe('isNanoid benchmarks', () => {
	bench('valid input', () => {
		schema.execute('V1StGXR8_Z5jdHi6B-myT')
	})

	bench('invalid input', () => {
		schema.execute('abc def')
	})
})
