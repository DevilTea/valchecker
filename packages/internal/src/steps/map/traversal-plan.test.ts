import { describe, expect, it } from 'vitest'
import { check, createValchecker, map, number, object, string } from '../..'

const v = createValchecker({ steps: [check, map, number, object, string] })

describe('map traversal plans', () => {
	it('does not call the snapshot forEach path for identity key and value schemas', () => {
		const input = new Map([['a', 1], ['b', 2]])
		Object.defineProperty(input, 'forEach', {
			value: () => {
				throw new Error('snapshot path used')
			},
		})

		const result = v.map({ key: v.string(), value: v.number() }).execute(input)

		expect(result).toEqual({ value: new Map([['a', 1], ['b', 2]]) })
		if (v.isSuccess(result))
			expect(result.value).not.toBe(input)
	})

	it('keeps direct traversal for identity-only classifier chains', () => {
		const input = new Map([['a', 1]])
		Object.defineProperty(input, 'forEach', {
			value: () => {
				throw new Error('snapshot path used')
			},
		})

		expect(v.map({
			key: v.string().string(),
			value: v.number().number(),
		}).execute(input)).toEqual({
			value: new Map([['a', 1]]),
		})
	})

	it('uses the snapshot path when a child pipeline includes an untrusted step', () => {
		const input = new Map([['a', 1]])
		let snapshotUsed = false
		Object.defineProperty(input, 'forEach', {
			value(callback: (value: number, key: string, map: Map<string, number>) => void) {
				snapshotUsed = true
				return Map.prototype.forEach.call(this, callback)
			},
		})

		expect(v.map({
			key: v.string().check(() => true),
			value: v.number(),
		}).execute(input)).toEqual({
			value: new Map([['a', 1]]),
		})
		expect(snapshotUsed).toBe(true)
	})

	it('keeps snapshot semantics when object property access mutates the source Map', () => {
		const input = new Map<string, { label: string }>()
		const first = Object.defineProperty({}, 'label', {
			enumerable: true,
			get() {
				input.set('later', { label: 'later' })
				return 'first'
			},
		}) as { label: string }
		input.set('first', first)

		const result = v.map({
			key: v.string(),
			value: v.object({ label: v.string() }),
		}).execute(input)

		expect(result).toEqual({
			value: new Map([['first', { label: 'first' }]]),
		})
		expect(input.has('later')).toBe(true)
	})
})
