/**
 * Test plan for intersection step:
 * - Functions tested: branch validation and recursive output composition.
 * - Valid inputs: equal values, nested plain objects, symbol keys, compatible cycles, async branches.
 * - Invalid inputs: branch failures, primitive conflicts, non-plain object conflicts, incompatible aliases.
 * - Expected behaviors: compatible outputs compose without data loss or reference-topology changes.
 */

import { describe, expect, it, vi } from 'vitest'
import { createValchecker, intersection, number, object, string, transform, unknown } from '../..'
import { structuralFixture } from '../../test-utils/fixtures'
import { syncResult } from '../../test-utils/helpers'

const fixture = structuralFixture

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
		if (v.isSuccess(result)) {
			expect(result.value)
				.toBe(shared)
		}
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

	it('should reject a shared reference after it was merged with a distinct partner', () => {
		const shared = { value: true }
		const partner = { value: true }
		const left = { first: shared, second: shared }
		const right = { first: partner, second: shared }
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
					payload: {
						path: ['second'],
						reason: 'incompatible_alias',
					},
				}],
			})
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
					category: 'validation',
					payload: { path: [], leftBranch: 0, rightBranch: 1, leftValue: 'left', rightValue: 'right', reason: 'different_values' },
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
					category: 'validation',
					payload: { path: [], leftBranch: 0, rightBranch: 1, leftValue: left, rightValue: right, reason: 'different_references' },
				}],
			})
	})

	it('should reject plain and non-plain object combinations', () => {
		const left = { value: true }
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
					payload: { reason: 'incompatible_prototype', leftValue: left, rightValue: right },
				}],
			})
	})

	it('should reject non-plain objects with different prototypes', () => {
		const left = new Date(0)
		const right = /value/
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
					payload: { reason: 'incompatible_prototype', leftValue: left, rightValue: right },
				}],
			})
	})

	it('should reject plain objects with different prototypes', () => {
		const left = Object.assign(Object.create(null) as Record<string, unknown>, { value: true })
		const right = { value: true }
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
					payload: { reason: 'incompatible_prototype', leftValue: left, rightValue: right },
				}],
			})
	})

	it('should distinguish incompatible cycles from aliases in either direction', () => {
		const cyclic: Record<string, unknown> = {}
		cyclic.self = cyclic
		const nested: Record<string, unknown> = {}
		nested.self = nested
		const split = { self: nested }

		for (const [left, right] of [[cyclic, split], [split, cyclic]]) {
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
						payload: { reason: 'incompatible_cycle' },
					}],
				})
		}
	})

	it('should not re-run accessors while locating a three-branch conflict source', () => {
		let leftReads = 0
		let rightReads = 0
		const left = Object.defineProperty({}, 'nested', {
			enumerable: true,
			get() {
				leftReads++
				return { value: 'left' }
			},
		})
		const right = Object.defineProperty({}, 'nested', {
			enumerable: true,
			get() {
				rightReads++
				return { value: 'right' }
			},
		})
		const result = v.intersection([
			v.unknown()
				.transform(() => ({ unrelated: true })),
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
					payload: { path: ['nested', 'value'], leftBranch: 1, rightBranch: 2 },
				}],
			})
		expect(leftReads)
			.toBe(1)
		expect(rightReads)
			.toBe(1)
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

	it('should start remaining async branches in parallel when collecting all issues', async () => {
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
		], { collectAllIssues: true })
			.execute('value')
		expect(started)
			.toBe(2)
		release()
		expect(await result)
			.toEqual({ value: { left: 'value', right: 'value' } })
	})
})

describe('intersection collectAllIssues', () => {
	const v = createValchecker({ steps: [fixture, intersection, number, transform, unknown] })

	it('merges compatible synchronous branch outputs', () => {
		expect(v.intersection([
			v.unknown()
				.transform(() => ({ left: true })),
			v.unknown()
				.transform(() => ({ right: true })),
		], { collectAllIssues: true })
			.execute(null))
			.toEqual({ value: { left: true, right: true } })
	})

	it('applies the enclosing message to output conflicts', () => {
		expect(v.intersection([
			v.unknown()
				.transform(() => 'left'),
			v.unknown()
				.transform(() => 'right'),
		], { collectAllIssues: true, message: 'conflict' })
			.execute(null))
			.toMatchObject({
				issues: [{ code: 'intersection:conflicting_outputs', message: 'conflict' }],
			})
	})

	it('continues default asynchronous evaluation only after successful branches', async () => {
		await expect(v.intersection([
			v.unknown()
				.transform(async value => ({ left: value })),
			v.unknown()
				.transform(value => ({ right: value })),
		])
			.execute('ok'))
			.resolves.toEqual({ value: { left: 'ok', right: 'ok' } })

		await expect(v.intersection([
			v.unknown()
				.transform(async value => value),
			v.number(),
		])
			.execute('bad'))
			.resolves.toMatchObject({ issues: [{ code: 'number:expected_number' }] })
	})

	it('stops later synchronous branches after an internal issue', () => {
		const later = vi.fn()
		const result = (v as any).intersection([
			(v as any).unknown()
				.internalFailure(),
			(v as any).unknown()
				.observe(later),
		], { collectAllIssues: true })
			.execute('value')

		expect(result)
			.toMatchObject({ issues: [{ code: 'core:unknown_exception' }] })
		expect(later).not.toHaveBeenCalled()
	})
})

describe('intersection asynchronous branch contracts', () => {
	const v = createValchecker({ steps: [intersection, number, transform, unknown] })

	it('returns an asynchronous branch failure without merging partial outputs', async () => {
		const result = v.intersection([
			v.unknown()
				.transform(async value => ({ value })),
			v.number(),
		])
			.execute('invalid')

		expect(result)
			.toBeInstanceOf(Promise)
		await expect(result).resolves.toMatchObject({
			issues: [{
				code: 'number:expected_number',
				payload: { value: 'invalid' },
			}],
		})
	})
})

describe('intersection disjoint plain-object outputs', () => {
	const v = createValchecker({ steps: [intersection, transform, unknown] })

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

describe('intersection issue collection', () => {
	const v = createValchecker({
		steps: [fixture, intersection, string, unknown],
	})

	it('preserves earlier recoverable issues but stops at a synchronous internal issue', () => {
		const later = vi.fn()
		const result = (v as any).intersection([
			v.string(),
			(v as any).unknown()
				.internalFailure(),
			(v as any).unknown()
				.observe(later),
		], { collectAllIssues: true })
			.execute(1)

		expect(result)
			.toMatchObject({
				issues: [
					{
						code: 'string:expected_string',
						category: 'validation',
					},
					{
						code: 'core:unknown_exception',
						category: 'internal',
						payload: { method: 'internalFailure' },
					},
				],
			})
		expect(later).not.toHaveBeenCalled()
	})
})
