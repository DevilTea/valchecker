import { describe, expect, it } from 'vitest'
import { createValchecker, intersection, transform, unknown } from '../..'
import { syncResult } from '../../test-utils/helpers'

const v = createValchecker({ steps: [intersection, transform, unknown] })

describe('intersection disjoint plain-object outputs', () => {
	it('merges disjoint string and symbol keys while preserving the shared prototype', () => {
		const rightKey = Symbol('right')
		const left = Object.assign(Object.create(null), { left: 'Ada' })
		const right = Object.assign(Object.create(null), { [rightKey]: 37 })

		const result = syncResult(v.intersection([
			v.unknown()
				.transform(() => left),
			v.unknown()
				.transform(() => right),
		])
			.execute(null))

		expect(v.isSuccess(result))
			.toBe(true)
		if (v.isSuccess(result)) {
			expect(Object.getPrototypeOf(result.value))
				.toBe(null)
			expect(result.value)
				.toEqual({ left: 'Ada', [rightKey]: 37 })
		}
	})
})
