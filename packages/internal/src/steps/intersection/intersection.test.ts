/**
 * Test plan for intersection step:
 * - Functions tested: branch validation and recursive output composition.
 * - Valid inputs: equal values, nested plain objects, symbol keys, compatible cycles, async branches.
 * - Invalid inputs: branch failures, primitive conflicts, non-plain object conflicts, incompatible aliases.
 * - Expected behaviors: compatible outputs compose without data loss or reference-topology changes.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, intersection, number, object, string, transform, unknown } from '../..'

const v = createValchecker({ steps: [intersection, string, number, object, transform, unknown] })

describe('intersection plugin', () => {
	it('should preserve equal primitive outputs', () => {
		const result = v.intersection([v.string(), v.string()])
			.execute('hello')
		expect(result)
			.toEqual({ value: 'hello' })
	})

	it('should preserve the same plain-object reference', () => {
		const shared = { value: true }
		const result = v.intersection([
			v.unknown()
				.transform(() => shared),
			v.unknown()
				.transform(() => shared),
		])
			.execute(null)

		expect(result)
			.toEqual({ value: shared })
		if (v.isSuccess(result))
			expect(result.value).toBe(shared)
	})

	it('should recursively merge compatible nested object outputs', () => {
		const result = v.intersection([
			v.object({ user: v.object({ name: v.string() }) }),
			v.object({ user: v.object({ age: v.number() }) }),
		])
			.execute({ user: { name: 'Ada', age: 37 } })
		expect(result)
			.toEqual({ value: { user: { name: 'Ada', age: 37 } } })
	})

	it('should preserve enumerable symbol keys', () => {
		const key = Symbol('shared')
		const result = v.intersection([
			v.unknown()
				.transform(() => ({ [key]: 'value', left: true })),
			v.unknown()
				.transform(() => ({ [key]: 'value', right: true })),
		])
			.execute(null)
		expect(result)
			.toEqual({ value: { [key]: 'value', left: true, right: true } })
	})

	it('should use the enumerable value when the other property is non-enumerable', () => {
		const left = Object.defineProperty({ left: true }, 'value', {
			enumerable: false,
			value: 'hidden',
		})
		const right = { right: true, value: 'visible' }
		const result = v.intersection([
			v.unknown()
				.transform(() => left),
			v.unknown()
				.transform(() => right),
		])
			.execute(null)

		expect(result)
			.toEqual({ value: { left: true, right: true, value: 'visible' } })
	})

	it('should snapshot enumerable accessor values once per output object', () => {
		let leftReads = 0
		let rightReads = 0
		const left = Object.defineProperty({}, 'value', {
			enumerable: true,
			get() {
				leftReads++
				return 'same'
			},
		})
		const right = Object.defineProperty({}, 'value', {
			enumerable: true,
			get() {
				rightReads++
				return 'same'
			},
		})
		const result = v.intersection([
			v.unknown()
				.transform(() => left),
			v.unknown()
				.transform(() => right),
		])
			.execute(null)

		expect(result)
			.toEqual({ value: { value: 'same' } })
		expect(leftReads)
			.toBe(1)
		expect(rightReads)
			.toBe(1)
	})

	it('should merge compatible cyclic outputs without breaking the cycle', () => {
		const left: Record<string, unknown> = { left: true }
		left.self = left
		const right: Record<string, unknown> = { right: true }
		right.self = right
		const result = v.intersection([
			v.unknown()
				.transform(() => left),
			v.unknown()
				.transform(() => right),
		])
			.execute(null)

		expect(v.isSuccess(result))
			.toBe(true)
		if (v.isSuccess(result)) {
			const output = result.value as Record<string, unknown>
			expect(output.left)
				.toBe(true)
			expect(output.right)
				.toBe(true)
			expect(output.self)
				.toBe(output)
		}
	})

	it('should preserve one-sided cycles and aliases', () => {
		const shared = { value: true }
		const left: Record<string, unknown> = {
			first: shared,
			second: shared,
		}
		left.self = left

		const result = v.intersection([
			v.unknown()
				.transform(() => left),
			v.unknown()
				.transform(() => ({ added: true })),
		])
			.execute(null)

		expect(v.isSuccess(result))
			.toBe(true)
		if (v.isSuccess(result)) {
			const output = result.value as Record<string, unknown>
			expect(output.self)
				.toBe(output)
			expect(output.first)
				.toBe(output.second)
			expect(output.added)
				.toBe(true)
		}
	})

	it('should reject incompatible shared-reference topology', () => {
		const shared = {}
		const aliased = { first: shared, second: shared }
		const split = { first: {}, second: {} }

		for (const [left, right] of [[aliased, split], [split, aliased]]) {
			const result = v.intersection([
				v.unknown()
					.transform(() => left),
				v.unknown()
					.transform(() => right),
			])
				.execute(null)
			expect(result)
				.toMatchObject({
					issues: [{ code: 'intersection:conflicting_outputs' }],
				})
		}
	})

	it('should fail when a branch fails', () => {
		const result = v.intersection([v.string(), v.number()])
			.execute('hello')
		expect(result)
			.toMatchObject({ issues: [{ code: 'number:expected_number' }] })
	})

	it('should reject conflicting primitive outputs', () => {
		const result = v.intersection([
			v.string()
				.transform(() => 'left'),
			v.string()
				.transform(() => 'right'),
		])
			.execute('input')
		expect(result)
			.toMatchObject({
				issues: [{
					code: 'intersection:conflicting_outputs',
					payload: { outputs: ['left', 'right'] },
				}],
			})
	})

	it('should reject distinct non-plain object outputs instead of stripping their state', () => {
		const left = new Date(0)
		const right = new Date(0)
		const result = v.intersection([
			v.unknown()
				.transform(() => left),
			v.unknown()
				.transform(() => right),
		])
			.execute(null)
		expect(result)
			.toMatchObject({
				issues: [{
					code: 'intersection:conflicting_outputs',
					payload: { outputs: [left, right] },
				}],
			})
	})

	it('should preserve the same non-plain object reference', () => {
		const date = new Date(0)
		const result = v.intersection([
			v.unknown()
				.transform(() => date),
			v.unknown()
				.transform(() => date),
		])
			.execute(null)
		expect(result)
			.toEqual({ value: date })
	})

	it('should start remaining async branches in parallel', async () => {
		let started = 0
		let release!: () => void
		const gate = new Promise<void>((resolve) => {
			release = resolve
		})
		const result = v.intersection([
			v.unknown()
				.transform(async (value) => {
					started++
					await gate
					return { left: value }
				}),
			v.unknown()
				.transform(async (value) => {
					started++
					await gate
					return { right: value }
				}),
		])
			.execute('value')
		expect(started)
			.toBe(2)
		release()
		expect(await result)
			.toEqual({ value: { left: 'value', right: 'value' } })
	})
})
