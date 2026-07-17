import { bench, describe } from 'vitest'
import { createValchecker, isEmpty, string } from '../..'

const schema = createValchecker({ steps: [string, isEmpty] }).string().isEmpty()

describe('isEmpty benchmarks', () => {
	bench('empty string', () => {
		schema.execute('')
	})

	bench('non-empty string', () => {
		schema.execute('value')
	})
})
