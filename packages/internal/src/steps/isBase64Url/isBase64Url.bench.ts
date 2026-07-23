import { bench, describe } from 'vitest'
import { createValchecker, isBase64Url, string } from '../..'

const schema = createValchecker({ steps: [string, isBase64Url] })
	.string()
	.isBase64Url()

describe('isBase64Url benchmarks', () => {
	bench('valid input', () => {
		schema.execute('aGVsbG8')
	})

	bench('invalid input', () => {
		schema.execute('a+b/c')
	})
})
