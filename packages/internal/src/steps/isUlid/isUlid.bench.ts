import { bench, describe } from 'vitest'
import { createValchecker, isUlid, string } from '../..'

const schema = createValchecker({ steps: [string, isUlid] })
	.string()
	.isUlid()

describe('isUlid benchmarks', () => {
	bench('valid input', () => {
		schema.execute('01ARZ3NDEKTSV4RRFFQ69G5FAV')
	})

	bench('invalid input', () => {
		schema.execute('01ARZ3NDEKTSV4RRFFQ69G5FA')
	})
})
