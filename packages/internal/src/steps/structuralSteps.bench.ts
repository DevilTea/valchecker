import { bench, describe } from 'vitest'
import {
	createValchecker,
	literal,
	map,
	number,
	object,
	picklist,
	record,
	set,
	string,
	tuple,
	variant,
} from '..'

const v = createValchecker({ steps: [literal, map, number, object, picklist, record, set, string, tuple, variant] })
const picklistSchema = v.picklist(['a', 'b', 'c'] as const)
const tupleSchema = v.tuple([v.string(), v.number()] as const)
const recordSchema = v.record(v.string(), v.number())
const mapSchema = v.map(v.string(), v.number())
const setSchema = v.set(v.string())
const variantSchema = v.variant('type', {
	a: v.object({ type: v.literal('a') }),
	b: v.object({ type: v.literal('b') }),
})

describe('structural step benchmarks', () => {
	bench('picklist valid', () => picklistSchema.execute('b'))
	bench('tuple valid', () => tupleSchema.execute(['a', 1]))
	bench('record valid', () => recordSchema.execute({ a: 1, b: 2 }))
	bench('map valid', () => mapSchema.execute(new Map([['a', 1]])))
	bench('set valid', () => setSchema.execute(new Set(['a', 'b'])))
	bench('variant valid', () => variantSchema.execute({ type: 'a' }))
})
