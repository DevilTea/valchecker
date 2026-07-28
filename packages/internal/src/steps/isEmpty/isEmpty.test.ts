import { describe, expect, it } from 'vitest'
import { any, array, createValchecker, isEmpty, map, number, set, string } from '../..'

const v = createValchecker({ steps: [any, string, number, array, map, set, isEmpty] })

describe('isEmpty step plugin', () => {
	it.each([
		[v.string()
			.isEmpty(), ''],
		[v.array(v.number())
			.isEmpty(), []],
		[v.set(v.string())
			.isEmpty(), new Set()],
		[v.map({ key: v.string(), value: v.number() })
			.isEmpty(), new Map()],
	] as const)('accepts empty length- and size-bearing values', (schema, value) => {
		expect(schema.execute(value as never))
			.toEqual({ value })
	})

	it('preserves the length payload for length-bearing values', () => {
		expect(v.string()
			.isEmpty()
			.execute('x'))
			.toEqual({
				issues: [{
					code: 'isEmpty:expected_empty',
					category: 'validation',
					message: 'Expected an empty value.',
					path: [],
					payload: { length: 1, value: 'x' },
				}],
			})
	})

	it('uses the size payload for size-bearing values', () => {
		const value = new Set(['x'])
		expect(v.set(v.string())
			.isEmpty()
			.execute(value))
			.toEqual({
				issues: [{
					code: 'isEmpty:expected_empty',
					category: 'validation',
					message: 'Expected an empty value.',
					path: [],
					payload: { size: 1, value },
				}],
			})
	})

	it('reads a dynamic length once and snapshots the observed value', () => {
		let reads = 0
		const value = {
			get length() {
				reads++
				return reads === 1 ? 1 : 0
			},
		}

		const result = v.any()
			.isEmpty()
			.execute(value)
		expect(reads)
			.toBe(1)
		expect(v.isFailure(result))
			.toBe(true)
		if (v.isFailure(result)) {
			const issue = result.issues[0]!
			if (issue.code !== 'isEmpty:expected_empty')
				throw new Error(`Unexpected issue: ${issue.code}`)
			expect(issue.payload)
				.toMatchObject({ length: 1 })
			expect(issue.payload.value)
				.toBe(value)
		}
		expect(reads)
			.toBe(1)
	})

	it('reads a dynamic size once and snapshots the observed value', () => {
		let reads = 0
		const value = {
			get size() {
				reads++
				return reads === 1 ? 1 : 0
			},
		}

		const result = v.any()
			.isEmpty()
			.execute(value)
		expect(reads)
			.toBe(1)
		expect(v.isFailure(result))
			.toBe(true)
		if (v.isFailure(result)) {
			const issue = result.issues[0]!
			if (issue.code !== 'isEmpty:expected_empty')
				throw new Error(`Unexpected issue: ${issue.code}`)
			expect(issue.payload)
				.toMatchObject({ size: 1 })
			expect(issue.payload.value)
				.toBe(value)
		}
		expect(reads)
			.toBe(1)
	})

	it('supports custom messages for both payload variants', () => {
		expect(v.string()
			.isEmpty({ message: issue => `length:${'length' in issue.payload}` })
			.execute('x'))
			.toMatchObject({ issues: [{ message: 'length:true' }] })
		expect(v.set(v.string())
			.isEmpty({ message: issue => `size:${'size' in issue.payload}` })
			.execute(new Set(['x'])))
			.toMatchObject({ issues: [{ message: 'size:true' }] })
	})
})
