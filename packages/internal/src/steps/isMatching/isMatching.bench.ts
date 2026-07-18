import { bench, describe } from 'vitest'
import { createValchecker, isMatching, string } from '../..'

const v = createValchecker({ steps: [isMatching, string] })
const schema = v.string().isMatching(/^[a-z]+$/)

describe('isMatching benchmarks', () => {
	bench('successful execution', () => {
		schema.execute('value')
	})

	bench('failed execution', () => {
		schema.execute('123')
	})
})
