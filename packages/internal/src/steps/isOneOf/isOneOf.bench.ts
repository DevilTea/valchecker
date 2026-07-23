import { bench, describe } from 'vitest'
import { createValchecker, isOneOf, string } from '../..'

const v = createValchecker({ steps: [isOneOf, string] })
const schema = v.string()
	.isOneOf(['draft', 'published'])

describe('isOneOf benchmarks', () => {
	bench('successful execution', () => {
		schema.execute('draft')
	})

	bench('failed execution', () => {
		schema.execute('archived')
	})
})
