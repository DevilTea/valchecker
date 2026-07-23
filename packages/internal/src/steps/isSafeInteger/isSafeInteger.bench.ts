import { bench, describe } from 'vitest'
import { createValchecker, isSafeInteger, number } from '../..'

const v = createValchecker({ steps: [isSafeInteger, number] })
const schema = v.number()
	.isSafeInteger()

describe('isSafeInteger benchmarks', () => {
	bench('successful execution', () => {
		schema.execute(42)
	})

	bench('failed execution', () => {
		schema.execute(1.5)
	})
})
