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

	it('keeps an own __proto__ data key own without reassigning the prototype', () => {
		// The Object.prototype fast path uses object spread (CreateDataProperty),
		// so an own enumerable `__proto__` data property must stay an own data
		// property rather than mutating the merged object's prototype.
		const left: Record<string, unknown> = {}
		Object.defineProperty(left, '__proto__', { value: 'raw', enumerable: true, writable: true, configurable: true })
		const right = { right: 1 }

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
				.toBe(Object.prototype)
			const descriptor = Object.getOwnPropertyDescriptor(result.value, '__proto__')
			expect(descriptor?.value)
				.toBe('raw')
			expect((result.value as Record<string, unknown>).right)
				.toBe(1)
		}
	})
})
