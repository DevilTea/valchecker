import { bench, describe } from 'vitest'
import { createValchecker, isDefined, unknown } from '../..'

const v = createValchecker({ steps: [isDefined, unknown] })
const schema = v.unknown()
	.isDefined()

describe('isDefined benchmarks', () => {
	bench('successful execution', () => {
		schema.execute('value')
	})

	bench('failed execution', () => {
		schema.execute(undefined)
	})
})
