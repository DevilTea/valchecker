import { describe, expect, it } from 'vitest'
import { implStepPlugin } from '../../core'
import { preserveExecutionEffects, getExecutionEffects, withExecutionEffects } from '../../core/execution-effects'
import { createValchecker, map, number, object, string } from '../..'

const double = withExecutionEffects(implStepPlugin<any>({
	double: ({ utils }: any) => {
		utils.addSuccessStep((value: number) => utils.success(value * 2), 'sync')
	},
}, 'sync'), {
	double: previous => preserveExecutionEffects(previous, {
		identity: 'may-transform',
		structuralOutput: null,
	}),
})

const v = createValchecker({ steps: [map, number, object, string, double] }) as any

describe('map traversal plans', () => {
	it('uses direct traversal only for synchronous direct-safe child schemas', () => {
		const direct = v.map({ key: v.string(), value: v.number() })
		const snapshot = v.map({
			key: v.string(),
			value: v.object({ label: v.string() }),
		})

		expect(getExecutionEffects(direct)).toEqual({
			identity: 'may-transform',
			parentTraversal: 'direct-safe',
			structuralOutput: null,
		})
		expect(getExecutionEffects(snapshot).parentTraversal).toBe('snapshot-required')
	})

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

	it('directly traverses identity keys with a trusted direct-safe value transform', () => {
		const input = new Map([['a', 1], ['b', 2]])
		Object.defineProperty(input, 'forEach', {
			value: () => {
				throw new Error('snapshot path used')
			},
		})

		expect(v.map({
			key: v.string(),
			value: v.number().double(),
		}).execute(input)).toEqual({
			value: new Map([['a', 2], ['b', 4]]),
		})
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
