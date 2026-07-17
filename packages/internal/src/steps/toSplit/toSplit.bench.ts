import { bench, describe } from 'vitest'
import { createValchecker, string, toSplit } from '../..'

const schema = createValchecker({ steps: [string, toSplit] }).string().toSplit(',')

describe('toSplit benchmarks', () => {
	bench('split string', () => {
		schema.execute('a,b,c')
	})
})
