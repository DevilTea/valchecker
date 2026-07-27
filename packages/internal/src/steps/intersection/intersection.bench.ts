import { bench, describe } from 'vitest'
import { createValchecker, intersection, isLengthAtLeast, number, object, string } from '../..'

const v = createValchecker({ steps: [intersection, string, isLengthAtLeast, number, object] })
const schema = v.intersection([
	v.string(),
	v.string()
		.isLengthAtLeast(5),
])

// Object branches exercise the output-merge path that primitive branches never
// reach: disjoint flat objects take the shallow fast path, while overlapping or
// nested keys fall through to the graph merge, which pairs and clones values.
const disjointFlat = v.intersection([
	v.object({ left: v.string() }),
	v.object({ right: v.number() }),
])
const disjointFlatInput = { left: 'left', right: 1 }

const overlappingFlat = v.intersection([
	v.object({ shared: v.string(), left: v.string() }),
	v.object({ shared: v.string(), right: v.number() }),
])
const overlappingFlatInput = { shared: 'same', left: 'left', right: 1 }

const nested = v.intersection([
	v.object({ profile: v.object({ name: v.string() }) }),
	v.object({ profile: v.object({ name: v.string() }), extra: v.number() }),
])
const nestedInput = { profile: { name: 'Ada' }, extra: 1 }

describe('intersection benchmarks', () => {
	bench('valid input - small', () => {
		schema.execute('hello')
	})

	bench('valid input - large', () => {
		schema.execute('a'.repeat(1000))
	})

	bench('invalid input', () => {
		schema.execute('hi')
	})

	bench('merge disjoint flat objects', () => {
		disjointFlat.execute(disjointFlatInput)
	})

	bench('merge overlapping flat objects', () => {
		overlappingFlat.execute(overlappingFlatInput)
	})

	bench('merge nested objects', () => {
		nested.execute(nestedInput)
	})
})
