import { bench, describe } from 'vitest'
import { createValchecker, isStartingWith, string } from '../..'

const schema = createValchecker({ steps: [string, isStartingWith] }).string().isStartingWith('prefix')

describe('isStartingWith benchmarks', () => {
	bench('matching prefix', () => {
		schema.execute('prefix-value')
	})

	bench('non-matching prefix', () => {
		schema.execute('value')
	})
})