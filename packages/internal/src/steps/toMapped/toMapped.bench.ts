import { bench, describe } from 'vitest'
import { array, createValchecker, number, set, toMapped } from '../..'

const v = createValchecker({ steps: [array, number, set, toMapped] })
const arraySchema = v.array(v.number())
	.toMapped(value => value * 2)
const arrayFailure = v.array(v.number())
	.toMapped(() => { throw new Error('x') })
const setSchema = v.set(v.number())
	.toMapped(value => value * 2)
const setFailure = v.set(v.number())
	.toMapped(() => { throw new Error('x') })
const setCollision = v.set(v.number())
	.toMapped(() => 0)
const smallArray = [1, 2, 3]
const smallSet = new Set([1, 2, 3])

describe('toMapped benchmarks', () => {
	bench('array success', () => {
		arraySchema.execute(smallArray)
	})

	bench('array callback failure', () => {
		arrayFailure.execute([1])
	})

	bench('set success', () => {
		setSchema.execute(smallSet)
	})

	bench('set callback failure', () => {
		setFailure.execute(new Set([1]))
	})

	bench('set mapped-item collision', () => {
		setCollision.execute(smallSet)
	})
})
