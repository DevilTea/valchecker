import { describe, expect, it } from 'vitest'
import { check, createValchecker, symbol } from '../..'

const v = createValchecker({ steps: [symbol, check] })

describe('symbol step plugin', () => {
	it.each([
		// A description-less symbol is the case under test, so `symbol-description`
		// is suppressed here rather than satisfied.
		// eslint-disable-next-line symbol-description
		Symbol(),
		Symbol('test'),
		Symbol.iterator,
		Symbol.for('registered'),
	])('accepts the symbol %p and preserves it', (value) => {
		expect(v.symbol()
			.execute(value))
			.toEqual({ value })
	})

	it('rejects a non-symbol with the value in the payload', () => {
		expect(v.symbol()
			.execute(42))
			.toEqual({
				issues: [{
					code: 'symbol:expected_symbol',
					category: 'validation',
					message: 'Expected a symbol.',
					path: [],
					payload: { value: 42 },
				}],
			})
	})

	it.each([
		'hello',
		true,
		null,
		undefined,
		{},
		[],
		123n,
	])('rejects the non-symbol %p', (value) => {
		expect(v.symbol()
			.execute(value))
			.toMatchObject({
				issues: [{ code: 'symbol:expected_symbol', payload: { value } }],
			})
	})

	it('rejects a boxed symbol, following `typeof` rather than `instanceof Symbol`', () => {
		const boxed = new Object(Symbol('boxed'))
		expect(boxed)
			.toBeInstanceOf(Symbol)
		expect(v.symbol()
			.execute(boxed))
			.toMatchObject({
				issues: [{ code: 'symbol:expected_symbol', payload: { value: boxed } }],
			})
	})

	it('supports a custom message', () => {
		expect(v.symbol({ message: 'Custom error message' })
			.execute(42))
			.toEqual({
				issues: [{
					code: 'symbol:expected_symbol',
					category: 'validation',
					message: 'Custom error message',
					path: [],
					payload: { value: 42 },
				}],
			})
	})

	it('keeps the symbol output available to a following step', () => {
		const sym = Symbol('test')
		expect(v.symbol()
			.check(value => value.description === 'test')
			.execute(sym))
			.toEqual({ value: sym })
	})
})
