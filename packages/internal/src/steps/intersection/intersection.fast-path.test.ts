import { describe, expect, it } from 'vitest'
import { createValchecker, intersection, number, object, string } from '../..'

const v = createValchecker({ steps: [intersection, number, object, string] })

describe('intersection disjoint plain-object fast path', () => {
	it('merges disjoint string and symbol keys while preserving the shared prototype', () => {
		const rightKey = Symbol('right')
		const prototype = Object.create(null)
		const input = Object.assign(Object.create(prototype), {
			left: 'Ada',
			[rightKey]: 37,
		})
		const left = Object.assign(Object.create(prototype), { left: 'Ada' })
		const right = Object.assign(Object.create(prototype), { [rightKey]: 37 })

		const result = v.intersection([
			v.object({ left: v.string() }),
			v.object({ [rightKey]: v.number() }),
		]).execute(input)

		expect(result).toEqual({ value: { left: 'Ada', [rightKey]: 37 } })
		if (v.isSuccess(result))
			expect(Object.getPrototypeOf(result.value)).toBe(Object.prototype)

		const plainResult = v.intersection([
			v.object({ left: v.string() }),
			v.object({ [rightKey]: v.number() }),
		]).execute({ ...left, ...right })
		expect(plainResult).toEqual({ value: { left: 'Ada', [rightKey]: 37 } })
	})
})
