import { bench, describe } from 'vitest'
import { createValchecker, isUrl, string } from '../..'

const schema = createValchecker({ steps: [string, isUrl] })
	.string()
	.isUrl()

describe('isUrl benchmarks', () => {
	bench('valid input', () => {
		schema.execute('https://example.com/path')
	})

	bench('invalid input', () => {
		schema.execute('not a url')
	})
})
