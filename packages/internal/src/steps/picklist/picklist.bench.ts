import { bench, describe } from 'vitest'
import { createValchecker, picklist } from '../..'

const v = createValchecker({ steps: [picklist] })
const schema = v.picklist(['a', 'b', 'c'] as const)

describe('picklist benchmarks', () => {
	bench('valid input', () => schema.execute('b'))
	bench('invalid input', () => schema.execute('x'))
})
