import { bench, describe } from 'vitest'
import { createValchecker, literal, number, object, variant } from '../..'

const v = createValchecker({ steps: [literal, number, object, variant] })
const schema = v.variant({
	discriminator: 'type',
	variants: {
		circle: v.object({ type: v.literal('circle'), radius: v.number() }),
		square: v.object({ type: v.literal('square'), size: v.number() }),
		triangle: v.object({ type: v.literal('triangle'), base: v.number(), height: v.number() }),
	},
})

describe('variant benchmarks', () => {
	bench('selected first branch', () => {
		schema.execute({ type: 'circle', radius: 1 })
	})

	bench('selected last branch', () => {
		schema.execute({ type: 'triangle', base: 2, height: 3 })
	})

	bench('invalid discriminator', () => {
		schema.execute({ type: 'unknown' })
	})
})
