/* eslint-disable no-template-curly-in-string -- test titles and canonical template payloads use literal `${...}` template-type notation, not JS interpolation */
import { describe, expect, it } from 'vitest'
import { any, bigint, boolean, createValchecker, literal, null_, number, object, string, templateLiteral, toTrimmed, undefined_, union } from '../..'

const v = createValchecker({
	steps: [templateLiteral, string, number, bigint, boolean, literal, null_, undefined_, union, any, object, toTrimmed],
})

describe('templateLiteral step plugin', () => {
	describe('${number}', () => {
		const schema = v.templateLiteral([v.number()])
		it.each([
			'42',
			'+1',
			'-1.5',
			'.5',
			'5.',
			'01',
			'1e3',
			'1E3',
			'1e+3',
			'+.5e-2',
			'0x10',
			'0X1F',
			'0o17',
			'0b101',
			' 1 ',
			'   ',
			'\n1\t',
		])('accepts %p', (input) => {
			expect(schema.execute(input))
				.toEqual({ value: input })
		})

		it.each(['', 'NaN', 'Infinity', '-Infinity', '1_000', '1e999', '-0x10'])('rejects string %p', (input) => {
			expect(schema.execute(input))
				.toMatchObject({
					issues: [{ code: 'templateLiteral:expected_template_literal' }],
				})
		})

		it.each([42, null, {}])('rejects non-string %p', (input) => {
			expect(schema.execute(input))
				.toMatchObject({
					issues: [{ code: 'templateLiteral:expected_template_literal' }],
				})
		})
	})

	describe('${bigint}', () => {
		const schema = v.templateLiteral([v.bigint()])
		it.each(['42', '-42', '0', '-0', '0x1f', '-0x1f', '0X1F', '0b101', '0o17'])('accepts %p', (input) => {
			expect(schema.execute(input))
				.toEqual({ value: input })
		})

		it.each(['+42', '01', '1.5', '1e3', ' 1', '1n', '1_000', ''])('rejects %p', (input) => {
			expect(schema.execute(input))
				.toMatchObject({
					issues: [{ code: 'templateLiteral:expected_template_literal' }],
				})
		})
	})

	describe('literal + placeholder combinations', () => {
		it.each(['ID-42'])('accepts %p for ID-${number}', (input) => {
			expect(v.templateLiteral(['ID-', v.number()])
				.execute(input))
				.toEqual({ value: input })
		})
		it.each(['ID-', 'ID-4x', 'id-42'])('rejects %p for ID-${number}', (input) => {
			expect(v.templateLiteral(['ID-', v.number()])
				.execute(input))
				.toMatchObject({
					issues: [{ code: 'templateLiteral:expected_template_literal' }],
				})
		})

		it.each(['1.5px', '1e2px', ' 1 px'])('accepts %p for ${number}px', (input) => {
			expect(v.templateLiteral([v.number(), 'px'])
				.execute(input))
				.toEqual({ value: input })
		})
		it.each(['px', '1pxpx'])('rejects %p for ${number}px', (input) => {
			expect(v.templateLiteral([v.number(), 'px'])
				.execute(input))
				.toMatchObject({
					issues: [{ code: 'templateLiteral:expected_template_literal' }],
				})
		})
	})

	describe('folded boolean / null / undefined', () => {
		it.each(['is:true', 'is:false'])('accepts %p for is:${boolean}', (input) => {
			expect(v.templateLiteral(['is:', v.boolean()])
				.execute(input))
				.toEqual({ value: input })
		})
		it.each(['is:0', 'is:TRUE'])('rejects %p for is:${boolean}', (input) => {
			expect(v.templateLiteral(['is:', v.boolean()])
				.execute(input))
				.toMatchObject({
					issues: [{ code: 'templateLiteral:expected_template_literal' }],
				})
		})

		it('accepts only "null/undefined" for [null, "/", undefined]', () => {
			const schema = v.templateLiteral([v.null(), '/', v.undefined()])
			expect(schema.execute('null/undefined'))
				.toEqual({ value: 'null/undefined' })
			expect(schema.execute('null/x'))
				.toMatchObject({
					issues: [{ code: 'templateLiteral:expected_template_literal' }],
				})
		})
	})

	describe('union cross-product', () => {
		const schema = v.templateLiteral([v.union(['a', 'b']), '-', v.union([1, 2])])
		it.each(['a-1', 'a-2', 'b-1', 'b-2'])('accepts %p', (input) => {
			expect(schema.execute(input))
				.toEqual({ value: input })
		})
		it.each(['c-1', 'a-3', 'a-1-b-2'])('rejects %p', (input) => {
			expect(schema.execute(input))
				.toMatchObject({
					issues: [{ code: 'templateLiteral:expected_template_literal' }],
				})
		})

		it.each(['autopx', '1.5px'])('accepts %p for [union([auto, number]), px]', (input) => {
			expect(v.templateLiteral([v.union(['auto', v.number()]), 'px'])
				.execute(input))
				.toEqual({ value: input })
		})
		it('rejects xpx for [union([auto, number]), px]', () => {
			expect(v.templateLiteral([v.union(['auto', v.number()]), 'px'])
				.execute('xpx'))
				.toMatchObject({
					issues: [{ code: 'templateLiteral:expected_template_literal' }],
				})
		})
	})

	// Regression: these outcomes follow the tsc leftmost / one-character / no-backtracking
	// split rule and diverge from a backtracking-regex encoding.
	describe('tsc split-rule parity', () => {
		it('${string}x${number}: leftmost delimiter, no backtracking', () => {
			const schema = v.templateLiteral([v.string(), 'x', v.number()])
			expect(schema.execute('ax1'))
				.toEqual({ value: 'ax1' })
			expect(schema.execute('axbx1'))
				.toMatchObject({ issues: [{ code: 'templateLiteral:expected_template_literal' }] })
			expect(schema.execute('axb'))
				.toMatchObject({ issues: [{ code: 'templateLiteral:expected_template_literal' }] })
		})

		it('${number}${string}: adjacent placeholders capture one char', () => {
			const schema = v.templateLiteral([v.number(), v.string()])
			expect(schema.execute('1abc'))
				.toEqual({ value: '1abc' })
			expect(schema.execute('123'))
				.toEqual({ value: '123' })
			expect(schema.execute('1e999abc'))
				.toEqual({ value: '1e999abc' })
			expect(schema.execute('abc'))
				.toMatchObject({ issues: [{ code: 'templateLiteral:expected_template_literal' }] })
			expect(schema.execute(''))
				.toMatchObject({ issues: [{ code: 'templateLiteral:expected_template_literal' }] })
		})

		it('${string}${number}: one-character rule rejects abc1', () => {
			expect(v.templateLiteral([v.string(), v.number()])
				.execute('abc1'))
				.toMatchObject({
					issues: [{ code: 'templateLiteral:expected_template_literal' }],
				})
		})

		it('${number}${number}', () => {
			const schema = v.templateLiteral([v.number(), v.number()])
			expect(schema.execute('12'))
				.toEqual({ value: '12' })
			expect(schema.execute('1'))
				.toMatchObject({ issues: [{ code: 'templateLiteral:expected_template_literal' }] })
		})

		it('${bigint}${string}', () => {
			const schema = v.templateLiteral([v.bigint(), v.string()])
			expect(schema.execute('1n'))
				.toEqual({ value: '1n' })
			expect(schema.execute('-1x'))
				.toMatchObject({ issues: [{ code: 'templateLiteral:expected_template_literal' }] })
		})

		it('${string}-${string}: fails when a middle delimiter is absent', () => {
			const schema = v.templateLiteral([v.string(), '-', v.string()])
			expect(schema.execute('a-b'))
				.toEqual({ value: 'a-b' })
			expect(schema.execute('nodash'))
				.toMatchObject({ issues: [{ code: 'templateLiteral:expected_template_literal' }] })
		})
	})

	describe('all-string reduction', () => {
		it('${string}${string} reduces to string', () => {
			const schema = v.templateLiteral([v.string(), v.string()])
			expect(schema.execute(''))
				.toEqual({ value: '' })
			expect(schema.execute('anything'))
				.toEqual({ value: 'anything' })
		})

		it('a${string}${string}b keeps literal anchors', () => {
			const schema = v.templateLiteral(['a', v.string(), v.string(), 'b'])
			expect(schema.execute('ab'))
				.toMatchObject({ issues: [{ code: 'templateLiteral:expected_template_literal' }] })
			expect(schema.execute('axb'))
				.toEqual({ value: 'axb' })
			expect(schema.execute('axyb'))
				.toEqual({ value: 'axyb' })
		})

		it('${string}${string}x keeps trailing literal', () => {
			const schema = v.templateLiteral([v.string(), v.string(), 'x'])
			expect(schema.execute('x'))
				.toMatchObject({ issues: [{ code: 'templateLiteral:expected_template_literal' }] })
			expect(schema.execute('ax'))
				.toEqual({ value: 'ax' })
		})
	})

	describe('overlapping anchors', () => {
		const schema = v.templateLiteral(['a', v.string(), 'a'])
		it('rejects single "a"', () => {
			expect(schema.execute('a'))
				.toMatchObject({ issues: [{ code: 'templateLiteral:expected_template_literal' }] })
		})
		it.each(['aa', 'aba'])('accepts %p', (input) => {
			expect(schema.execute(input))
				.toEqual({ value: input })
		})
	})

	describe('degenerate and fully-literal parts', () => {
		it('empty parts matches only the empty string', () => {
			const schema = v.templateLiteral([])
			expect(schema.execute(''))
				.toEqual({ value: '' })
			expect(schema.execute('x'))
				.toMatchObject({ issues: [{ code: 'templateLiteral:expected_template_literal' }] })
		})

		it.each([
			[['ab'] as const, 'ab'],
			[['a', 'b'] as const, 'ab'],
		])('%p matches only its literal text', (parts, expected) => {
			const schema = v.templateLiteral(parts as unknown as string[])
			expect(schema.execute(expected))
				.toEqual({ value: expected })
			expect(schema.execute(`${expected}!`))
				.toMatchObject({ issues: [{ code: 'templateLiteral:expected_template_literal' }] })
		})

		it('renders all interpolatable literal kinds', () => {
			const schema = v.templateLiteral(['#', 1, true, 2n, null, undefined])
			expect(schema.execute('#1true2nullundefined'))
				.toEqual({ value: '#1true2nullundefined' })
			expect(schema.execute('#1true2'))
				.toMatchObject({ issues: [{ code: 'templateLiteral:expected_template_literal' }] })
		})
	})

	describe('nesting', () => {
		const schema = v.templateLiteral([v.templateLiteral([v.number(), 'px']), '!'])
		it('accepts a nested-template match', () => {
			expect(schema.execute('1.5px!'))
				.toEqual({ value: '1.5px!' })
		})
		it.each(['1.5px', 'px!'])('rejects %p', (input) => {
			expect(schema.execute(input))
				.toMatchObject({ issues: [{ code: 'templateLiteral:expected_template_literal' }] })
		})
	})

	describe('issue contract', () => {
		it('reports the owned issue shape with a canonical template', () => {
			const result = v.templateLiteral([v.union(['a', 'b']), '-', v.union([1, 2])])
				.execute('c-9')
			expect(result)
				.toEqual({
					issues: [{
						code: 'templateLiteral:expected_template_literal',
						category: 'validation',
						path: [],
						payload: { value: 'c-9', template: '`${"a" | "b"}-${1 | 2}`' },
						message: 'Expected a string matching `${"a" | "b"}-${1 | 2}`.',
					}],
				})
		})

		it('renders open placeholders inside a union in the canonical template', () => {
			const result = v.templateLiteral([v.union([v.string(), 'x'])])
				.execute(42)
			expect(result)
				.toMatchObject({
					issues: [{
						code: 'templateLiteral:expected_template_literal',
						payload: { template: '`${string | "x"}`' },
					}],
				})
		})

		it('supports a custom message', () => {
			const result = v.templateLiteral(['ID-', v.number()], { message: 'Bad id' })
				.execute('nope')
			expect(result)
				.toMatchObject({ issues: [{ message: 'Bad id' }] })
		})

		it.each([42, 1n, true, null, undefined, {}])('fails the owned issue for non-string %p', (input) => {
			expect(v.templateLiteral([v.string()])
				.execute(input))
				.toMatchObject({
					issues: [{ code: 'templateLiteral:expected_template_literal' }],
				})
		})
	})

	describe('construction misuse throws', () => {
		it('rejects a non-array argument', () => {
			expect(() => v.templateLiteral('nope' as never))
				.toThrow(TypeError)
		})
		it('rejects a symbol part', () => {
			expect(() => v.templateLiteral([Symbol('x') as never]))
				.toThrow(TypeError)
		})
		it('rejects a plain-object part', () => {
			expect(() => v.templateLiteral([{} as never]))
				.toThrow(TypeError)
		})
		it('rejects a non-finite number part', () => {
			expect(() => v.templateLiteral([Number.NaN as never]))
				.toThrow(TypeError)
		})
		it('rejects a refined (chained) schema part', () => {
			expect(() => v.templateLiteral([v.string()
				.toTrimmed() as never]))
				.toThrow(TypeError)
		})
		it('rejects an any-output schema part', () => {
			expect(() => v.templateLiteral([v.any() as never]))
				.toThrow(TypeError)
		})
		it('rejects an object-schema part', () => {
			expect(() => v.templateLiteral([v.object({}) as never]))
				.toThrow(TypeError)
		})
		it('rejects a union part carrying a non-interpolatable branch', () => {
			expect(() => v.templateLiteral([v.union(['a', Symbol('x')]) as never]))
				.toThrow(TypeError)
			expect(() => v.templateLiteral([v.union([v.string()
				.toTrimmed()]) as never]))
				.toThrow(TypeError)
		})
		it('throws when the eager cross-product ceiling is exceeded', () => {
			const many = Array.from({ length: 101 }, (_, i) => String(i))
			expect(() => v.templateLiteral([v.union(many as [string, ...string[]]), v.union(many as [string, ...string[]])]))
				.toThrow(TypeError)
		})
	})
})
