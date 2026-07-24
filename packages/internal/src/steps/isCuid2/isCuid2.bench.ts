import { bench, describe } from 'vitest'
import { createValchecker, isCuid2, string } from '../..'

const schema = createValchecker({ steps: [string, isCuid2] })
	.string()
	.isCuid2()

describe('isCuid2 benchmarks', () => {
	bench('valid input', () => {
		schema.execute('tz4a98xxat96iws9zmbrgj3a')
	})

	bench('invalid input', () => {
		schema.execute('TZ4A')
	})
})
