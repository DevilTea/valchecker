import { bench, describe } from 'vitest'
import { createValchecker, isGreaterThan, number } from '../..'

const v = createValchecker({ steps: [isGreaterThan, number] })
const schema = v.number().isGreaterThan(0)

describe('isGreaterThan benchmarks', () => {
	bench('successful execution', () => {
		schema.execute(1)
	})

	bench('failed execution', () => {
		schema.execute(0)
	})
})
