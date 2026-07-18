import { bench, describe } from 'vitest'
import { createValchecker, isLessThan, number } from '../..'

const v = createValchecker({ steps: [isLessThan, number] })
const schema = v.number().isLessThan(10)

describe('isLessThan benchmarks', () => {
	bench('successful execution', () => {
		schema.execute(9)
	})

	bench('failed execution', () => {
		schema.execute(10)
	})
})
