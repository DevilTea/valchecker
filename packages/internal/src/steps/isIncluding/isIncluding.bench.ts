import { bench, describe } from 'vitest'
import { createValchecker, isIncluding, string } from '../..'

const v = createValchecker({ steps: [isIncluding, string] })
const schema = v.string().isIncluding('needle')

describe('isIncluding benchmarks', () => {
	bench('successful execution', () => {
		schema.execute('hay needle stack')
	})

	bench('failed execution', () => {
		schema.execute('haystack')
	})
})
