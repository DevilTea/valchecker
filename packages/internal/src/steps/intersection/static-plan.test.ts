import { describe, expect, it } from 'vitest'
import { getExecutionEffects } from '../../core/execution-effects'
import { createValchecker, intersection, number, object, string, transform, unknown } from '../..'

const v = createValchecker({
	steps: [intersection, number, object, string, transform, unknown],
})

describe('intersection static object merge plan', () => {
	it('publishes a fresh ordinary-object output for disjoint known branch keys', () => {
		const schema = v.intersection([
			v.object({ left: v.string() }),
			v.object({ right: v.number() }),
		])

		expect(getExecutionEffects(schema)).toEqual({
			identity: 'may-transform',
			parentTraversal: 'snapshot-required',
			structuralOutput: {
				kind: 'fresh-ordinary-object',
				keys: ['left', 'right'],
			},
		})
	})

	it('falls back when branch keys overlap', () => {
		const schema = v.intersection([
			v.object({ shared: v.string() }),
			v.object({ shared: v.string() }),
		])

		expect(getExecutionEffects(schema).structuralOutput).toBeNull()
		expect(schema.execute({ shared: 'value' })).toEqual({ value: { shared: 'value' } })
	})

	it('copies symbol and __proto__ keys without changing the output prototype', () => {
		const symbolKey = Symbol('right')
		const schema = v.intersection([
			v.object({ ['__proto__']: v.string() }),
			v.object({ [symbolKey]: v.number() }),
		])
		const input = {
			['__proto__']: 'safe',
			[symbolKey]: 1,
		}
		const result = schema.execute(input)

		expect(v.isSuccess(result)).toBe(true)
		if (v.isSuccess(result)) {
			expect(Object.getPrototypeOf(result.value)).toBe(Object.prototype)
			expect(Object.hasOwn(result.value, '__proto__')).toBe(true)
			expect(result.value['__proto__']).toBe('safe')
			expect(result.value[symbolKey]).toBe(1)
		}
	})

	it('uses the graph merger when a disjoint value is a plain object', () => {
		const source = { nested: { value: 1 } }
		const schema = v.intersection([
			v.object({ left: v.unknown().transform(() => source) }),
			v.object({ right: v.string() }),
		])
		const result = schema.execute({ left: null, right: 'value' })

		expect(v.isSuccess(result)).toBe(true)
		if (v.isSuccess(result)) {
			expect(result.value).toEqual({ left: source, right: 'value' })
			expect(result.value.left).not.toBe(source)
			expect(result.value.left.nested).not.toBe(source.nested)
		}
	})
})
