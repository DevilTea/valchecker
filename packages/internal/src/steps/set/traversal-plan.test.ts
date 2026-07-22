import { describe, expect, it } from 'vitest'
import { check, createValchecker, object, set, string } from '../..'

const v = createValchecker({ steps: [check, object, set, string] })

describe('set traversal plans', () => {
	it('does not call the snapshot values method for identity item schemas', () => {
		const input = new Set(['a', 'b'])
		Object.defineProperty(input, 'values', {
			value: () => {
				throw new Error('snapshot path used')
			},
		})

		const result = v.set(v.string()).execute(input)

		expect(result).toEqual({ value: new Set(['a', 'b']) })
		if (v.isSuccess(result))
			expect(result.value).not.toBe(input)
	})

	it('keeps direct traversal for identity-only classifier chains', () => {
		const input = new Set(['a'])
		Object.defineProperty(input, 'values', {
			value: () => {
				throw new Error('snapshot path used')
			},
		})

		expect(v.set(v.string().string()).execute(input)).toEqual({
			value: new Set(['a']),
		})
	})

	it('uses the snapshot path when the item pipeline includes an untrusted step', () => {
		const input = new Set(['a'])
		let snapshotUsed = false
		Object.defineProperty(input, 'values', {
			value() {
				snapshotUsed = true
				return Set.prototype.values.call(this)
			},
		})

		expect(v.set(v.string().check(() => true)).execute(input)).toEqual({
			value: new Set(['a']),
		})
		expect(snapshotUsed).toBe(true)
	})

	it('keeps snapshot semantics when object property access mutates the source Set', () => {
		const input = new Set<{ label: string }>()
		const first = Object.defineProperty({}, 'label', {
			enumerable: true,
			get() {
				input.add({ label: 'later' })
				return 'first'
			},
		}) as { label: string }
		input.add(first)

		const result = v.set(v.object({ label: v.string() })).execute(input)

		expect(result).toEqual({ value: new Set([{ label: 'first' }]) })
		expect(input.size).toBe(2)
	})
})
