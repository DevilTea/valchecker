import { bench, describe } from 'vitest'
import { createValchecker, isBase64, string } from '../..'

const schema = createValchecker({ steps: [string, isBase64] })
	.string()
	.isBase64()

describe('isBase64 benchmarks', () => {
	bench('valid input', () => {
		schema.execute('aGVsbG8=')
	})

	bench('invalid input', () => {
		schema.execute('aGVsbG8')
	})
})
