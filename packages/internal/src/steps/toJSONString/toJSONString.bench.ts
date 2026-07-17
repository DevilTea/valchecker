import { bench, describe } from 'vitest'
import { createValchecker, toJSONString } from '../..'

const schema = createValchecker({ steps: [toJSONString] }).toJSONString()

describe('toJSONString benchmarks', () => {
	bench('serializable object', () => {
		schema.execute({ value: 42 })
	})

	bench('unserializable value', () => {
		schema.execute({ value: () => undefined })
	})
})
