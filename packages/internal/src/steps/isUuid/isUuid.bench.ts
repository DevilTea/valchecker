import { bench, describe } from 'vitest'
import { createValchecker, isUuid, string } from '../..'

const schema = createValchecker({ steps: [string, isUuid] })
	.string()
	.isUuid()

describe('isUuid benchmarks', () => {
	bench('valid input', () => {
		schema.execute('123e4567-e89b-12d3-a456-426614174000')
	})

	bench('invalid input', () => {
		schema.execute('not-a-uuid')
	})
})
