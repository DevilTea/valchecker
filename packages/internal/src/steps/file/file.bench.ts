import { bench, describe } from 'vitest'
import { createValchecker, file } from '../..'

const schema = createValchecker({ steps: [file] })
	.file()
const validFile = new File(['data'], 'name.txt')

describe('file benchmarks', () => {
	bench('valid file', () => {
		schema.execute(validFile)
	})

	bench('invalid value', () => {
		schema.execute('not a file')
	})
})
