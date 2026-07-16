import { bench, describe } from 'vitest'
import { createValchecker, literal, object, variant } from '../..'

const v = createValchecker({ steps: [literal, object, variant] })
const schema = v.variant('type', { a: v.object({ type: v.literal('a') }), b: v.object({ type: v.literal('b') }) })

describe('variant benchmarks', () => {
	bench('valid input', () => schema.execute({ type: 'a' }))
	bench('invalid input', () => schema.execute({ type: 'x' }))
})
