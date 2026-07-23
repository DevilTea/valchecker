import { bench, describe } from 'vitest'
import { createValchecker, isNotEmpty, string } from '../..'

const schema = createValchecker({ steps: [string, isNotEmpty] })
	.string()
	.isNotEmpty()

describe('isNotEmpty benchmarks', () => {
	bench('non-empty string', () => {
		schema.execute('value')
	})

	bench('empty string', () => {
		schema.execute('')
	})
})
