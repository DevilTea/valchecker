import { bench, describe } from 'vitest'
import { createValchecker, isEndingWith, string } from '../..'

const schema = createValchecker({ steps: [string, isEndingWith] })
	.string()
	.isEndingWith('.txt')

describe('isEndingWith benchmarks', () => {
	bench('matching suffix', () => {
		schema.execute('file.txt')
	})

	bench('non-matching suffix', () => {
		schema.execute('file.md')
	})
})
