import { bench, describe } from 'vitest'
import { createValchecker, string, toJSONValue } from '../..'

const schema = createValchecker({ steps: [string, toJSONValue] }).string().toJSONValue()

describe('toJSONValue benchmarks', () => {
	bench('valid JSON', () => {
		schema.execute('{"value":42}')
	})

	bench('invalid JSON', () => {
		schema.execute('{')
	})
})
