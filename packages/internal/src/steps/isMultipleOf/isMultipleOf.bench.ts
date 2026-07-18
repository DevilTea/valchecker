import { bench, describe } from 'vitest'
import { createValchecker, isMultipleOf, number } from '../..'

const v = createValchecker({ steps: [isMultipleOf, number] })
const schema = v.number().isMultipleOf(5)

describe('isMultipleOf benchmarks', () => {
	bench('successful execution', () => {
		schema.execute(10)
	})

	bench('failed execution', () => {
		schema.execute(11)
	})
})
