import { bench, describe } from 'vitest'
import { blob, createValchecker } from '../..'

const schema = createValchecker({ steps: [blob] })
	.blob()
const validBlob = new Blob(['data'])

describe('blob benchmarks', () => {
	bench('valid blob', () => {
		schema.execute(validBlob)
	})

	bench('invalid value', () => {
		schema.execute('not a blob')
	})
})
