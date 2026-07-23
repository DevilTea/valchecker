import { bench, describe } from 'vitest'
import { createValchecker, isEqualTo, string } from '../..'

const v = createValchecker({ steps: [isEqualTo, string] })
const schema = v.string()
	.isEqualTo('ready')

describe('isEqualTo benchmarks', () => {
	bench('successful execution', () => {
		schema.execute('ready')
	})

	bench('failed execution', () => {
		schema.execute('other')
	})
})
