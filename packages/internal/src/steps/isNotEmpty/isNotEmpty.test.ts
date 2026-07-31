import { describe, expect, it } from 'vitest'
import { any, array, createValchecker, isNotEmpty, map, number, set, string } from '../..'

const v = createValchecker({ steps: [any, string, number, array, map, set, isNotEmpty] })

describe('isNotEmpty step plugin', () => {
	it.each([
		[v.string()
			.isNotEmpty(), 'value'],
		[v.array(v.number())
			.isNotEmpty(), [1]],
		[v.set(v.string())
			.isNotEmpty(), new Set(['value'])],
		[v.map({ key: v.string(), value: v.number() })
			.isNotEmpty(), new Map([['value', 1]])],
	] as const)('accepts non-empty length- and size-bearing values', (schema, value) => {
		expect(schema.execute(value as never))
			.toEqual({ value })
	})

	it('preserves the length payload for length-bearing values', () => {
		expect(v.string()
			.isNotEmpty()
			.execute(''))
			.toEqual({
				issues: [{
					code: 'isNotEmpty:expected_not_empty',
					category: 'validation',
					message: 'Expected a non-empty value.',
					path: [],
					payload: { length: 0, value: '' },
				}],
			})
	})

	it('uses the size payload for size-bearing values', () => {
		const value = new Map()
		expect(v.map({ key: v.string(), value: v.number() })
			.isNotEmpty()
			.execute(value))
			.toEqual({
				issues: [{
					code: 'isNotEmpty:expected_not_empty',
					category: 'validation',
					message: 'Expected a non-empty value.',
					path: [],
					payload: { size: 0, value },
				}],
			})
	})

	it('reads a dynamic length once and snapshots the observed value', () => {
		let reads = 0
		const value = {
			get length() {
				reads++
				return reads === 1 ? 0 : 3
			},
		}

		const result = v.any()
			.isNotEmpty()
			.execute(value)
		expect(reads)
			.toBe(1)
		expect(v.isFailure(result))
			.toBe(true)
		if (v.isFailure(result)) {
			const issue = result.issues[0]!
			if (issue.code !== 'isNotEmpty:expected_not_empty')
				throw new Error(`Unexpected issue: ${issue.code}`)
			expect(issue.payload)
				.toMatchObject({ length: 0 })
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
				return reads === 1 ? 0 : 3
			},
		}

		const result = v.any()
			.isNotEmpty()
			.execute(value)
		expect(reads)
			.toBe(1)
		expect(v.isFailure(result))
			.toBe(true)
		if (v.isFailure(result)) {
			const issue = result.issues[0]!
			if (issue.code !== 'isNotEmpty:expected_not_empty')
				throw new Error(`Unexpected issue: ${issue.code}`)
			expect(issue.payload)
				.toMatchObject({ size: 0 })
			expect(issue.payload.value)
				.toBe(value)
		}
		expect(reads)
			.toBe(1)
	})

	it('supports custom messages for size-bearing values', () => {
		expect(v.set(v.string())
			.isNotEmpty({ message: 'Custom non-empty' })
			.execute(new Set()))
			.toMatchObject({ issues: [{ message: 'Custom non-empty' }] })
	})
})
