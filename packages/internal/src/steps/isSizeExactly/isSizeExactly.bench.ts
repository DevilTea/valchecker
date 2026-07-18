import { bench, describe } from 'vitest'
import { createValchecker, isSizeExactly, map, number, string } from '../..'

const v = createValchecker({ steps: [isSizeExactly, map, number, string] })
const schema = v.map({ key: v.string(), value: v.number() }).isSizeExactly(1)
const valid = new Map([['value', 1]])
const invalid = new Map<string, number>()

describe('isSizeExactly benchmarks', () => {
	bench('success', () => schema.execute(valid))
	bench('failure', () => schema.execute(invalid))
})
