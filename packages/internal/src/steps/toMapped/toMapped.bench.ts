import { bench, describe } from 'vitest'
import { array, createValchecker, number, toMapped } from '../..'

const v = createValchecker({ steps: [array, number, toMapped] })
const schema = v.array(v.number()).toMapped(value => value * 2)

describe('toMapped benchmarks', () => {
	bench('successful execution', () => {
		schema.execute([1, 2, 3])
	})

	bench('callback failure', () => {
		v.array(v.number()).toMapped(() => { throw new Error('x') }).execute([1])
	})
})
