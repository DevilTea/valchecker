import { describe, expect, it } from 'vitest'
import { bigint, createValchecker, isFinite, isGreaterThan, number, string } from '../..'

const v = createValchecker({ steps: [bigint, isFinite, isGreaterThan, number, string] })

describe('isGreaterThan step plugin', () => {
	it.each([
		[1, 2],
		[1, Number.POSITIVE_INFINITY],
		[Number.NEGATIVE_INFINITY, 0],
	])('accepts a number above the bound %s', (minimum, value) => {
		expect(v.number()
			.isGreaterThan(minimum)
			.execute(value))
			.toEqual({ value })
	})

	it.each([
		[1, 1],
		[1, 0],
		[0, Number.NEGATIVE_INFINITY],
		[Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
	])('rejects a number not above the bound %s', (minimum, value) => {
		expect(v.number()
			.isGreaterThan(minimum)
			.execute(value))
			.toMatchObject({ issues: [{ code: 'isGreaterThan:expected_greater_than' }] })
	})

	it('rejects NaN, which no comparison satisfies', () => {
		expect(v.number()
			.isGreaterThan(0)
			.execute(Number.NaN))
			.toMatchObject({ issues: [{ code: 'isGreaterThan:expected_greater_than', payload: { value: Number.NaN } }] })
	})

	it('treats negative zero as equal to positive zero, unlike isEqualTo', () => {
		expect(v.number()
			.isGreaterThan(0)
			.execute(-0))
			.toMatchObject({ issues: [{ code: 'isGreaterThan:expected_greater_than' }] })
		expect(v.number()
			.isGreaterThan(-0)
			.execute(0))
			.toMatchObject({ issues: [{ code: 'isGreaterThan:expected_greater_than' }] })
	})

	it('carries no finiteness policy of its own', () => {
		expect(v.number()
			.isFinite()
			.isGreaterThan(0)
			.execute(Number.POSITIVE_INFINITY))
			.toMatchObject({ issues: [{ code: 'isFinite:expected_finite' }] })
	})

	it('reports the complete number issue with the interpolated default message', () => {
		expect(v.number()
			.isGreaterThan(1)
			.execute(1))
			.toEqual({
				issues: [{
					code: 'isGreaterThan:expected_greater_than',
					category: 'validation',
					message: 'Expected a value greater than 1.',
					path: [],
					payload: { target: 'number', value: 1, minimum: 1 },
				}],
			})
	})

	it('compares bigints exactly and reports the bigint payload variant', () => {
		expect(v.bigint()
			.isGreaterThan(1n)
			.execute(2n))
			.toEqual({ value: 2n })
		expect(v.bigint()
			.isGreaterThan(1n)
			.execute(1n))
			.toEqual({
				issues: [{
					code: 'isGreaterThan:expected_greater_than',
					category: 'validation',
					message: 'Expected a value greater than 1.',
					path: [],
					payload: { target: 'bigint', value: 1n, minimum: 1n },
				}],
			})
		expect(v.bigint()
			.isGreaterThan(1n, { message: 'Too small' })
			.execute(0n))
			.toMatchObject({ issues: [{ message: 'Too small', payload: { target: 'bigint' } }] })
	})

	it('follows the current output when typing the bound', () => {
		// Never invoked: every call below is an expected compile-time rejection, and
		// `pnpm typecheck` is what decides them. A function body keeps them reachable
		// code, so the block does not also raise TS7027 on its first statement.
		const rejectedAtCompileTime = (): void => {
			v.number()
				// @ts-expect-error a number output takes a number bound
				.isGreaterThan(1n)
			v.bigint()
				// @ts-expect-error a bigint output takes a bigint bound
				.isGreaterThan(1)
			v.string()
				// @ts-expect-error isGreaterThan is unavailable for a non-numeric output
				.isGreaterThan(1)
		}

		expect(rejectedAtCompileTime)
			.toBeTypeOf('function')
	})
})
