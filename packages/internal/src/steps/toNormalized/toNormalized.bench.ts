import { bench, describe } from 'vitest'
import { createValchecker, string, toNormalized } from '../..'

const v = createValchecker({ steps: [string, toNormalized] })
const schema = v.string().toNormalized()

describe('toNormalized benchmarks', () => {
	bench('successful execution', () => {
		schema.execute('e\u0301')
	})

	bench('failed execution', () => {
		schema.execute('plain')
	})
})
