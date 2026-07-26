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
		// The fast path assigns the scanned values, so an own enumerable
		// `__proto__` data property must be defined rather than assigned, which
		// would reassign the merged object's prototype through the inherited
		// setter.
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

	it('reads a disjoint enumerable accessor exactly once', () => {
		// The scan reads values instead of inspecting descriptors, so the merged
		// output must be built from what it read. Re-reading the live objects (an
		// object spread, for instance) invokes each getter a second time.
		let leftReads = 0
		let rightReads = 0
		const left = Object.defineProperty({}, 'left', {
			enumerable: true,
			get() {
				leftReads++
				return leftReads
			},
		})
		const right = Object.defineProperty({}, 'right', {
			enumerable: true,
			get() {
				rightReads++
				return 'right'
			},
		})

		const result = syncResult(v.intersection([
			v.unknown()
				.transform(() => left),
			v.unknown()
				.transform(() => right),
		])
			.execute(null))

		expect(result)
			.toEqual({ value: { left: 1, right: 'right' } })
		expect(leftReads)
			.toBe(1)
		expect(rightReads)
			.toBe(1)
	})

	it('declines the shallow merge when a nested plain object appears after the first key', () => {
		// The scan must keep going after it finds a nested object, so the values it
		// hands to the general merge are complete.
		// `last` comes after `nested`, so an implementation that stopped scanning at
		// the first nested object would hand the general merge an incomplete value
		// set and lose it.
		const left = { first: 'a', nested: { deep: true }, last: 'c' }
		const right = { second: 'b' }

		const result = syncResult(v.intersection([
			v.unknown()
				.transform(() => left),
			v.unknown()
				.transform(() => right),
		])
			.execute(null))

		expect(result)
			.toEqual({ value: { first: 'a', nested: { deep: true }, last: 'c', second: 'b' } })
		if (v.isSuccess(result)) {
			// The general merge clones nested plain objects rather than sharing them.
			expect((result.value as { nested: unknown }).nested)
				.not
				.toBe(left.nested)
		}
	})

	it('ignores a non-enumerable own symbol key', () => {
		const hidden = Symbol('hidden')
		const visible = Symbol('visible')
		const left = Object.defineProperty({ left: 1 }, hidden, { value: 'skipped', enumerable: false })
		const right = { [visible]: 'kept' }

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
			expect(Object.getOwnPropertySymbols(result.value))
				.toEqual([visible])
		}
	})

	it('drops a key a getter removed during the scan, like the general merge does', () => {
		// A getter that deletes a later key changes what is enumerable mid-scan, so
		// enumerability is re-checked per key instead of trusted from the initial
		// key snapshot. `nested` forces the general merge, which re-checks the same
		// way, so both paths must agree on the surviving keys.
		const left: Record<string, unknown> = {
			get first() {
				delete left.removed
				return 1
			},
			removed: 2,
			nested: {},
		}
		const right = { second: 'b' }

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
			expect(Object.keys(result.value as object))
				.toEqual(['first', 'nested', 'second'])
		}
	})
})
