import { bench, describe } from 'vitest'
import { createValchecker, isEmoji, string } from '../..'

const schema = createValchecker({ steps: [string, isEmoji] })
	.string()
	.isEmoji()

describe('isEmoji benchmarks', () => {
	bench('valid input', () => {
		schema.execute('😀')
	})

	bench('invalid input', () => {
		schema.execute('a')
	})
})
