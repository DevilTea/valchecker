import type { StepPluginImpl, TStepPluginDef } from './types'
import { expect, it } from 'vitest'
import { createValchecker, implStepPlugin } from './core'

const incrementPlugin = implStepPlugin({
	increment: ({ utils, params: [amount = 1] }: any) => {
		utils.addSuccessStep((value: number) => utils.success(value + amount))
	},
} as any) as StepPluginImpl<TStepPluginDef>

it('exposes immutable runtime-step snapshots without breaking chain persistence', () => {
	const v = createValchecker({ steps: [incrementPlugin] }) as any
	const incremented = v.increment(2)
	const chained = incremented.increment(3)

	const initialSteps = v['~core'].runtimeSteps
	const incrementedSteps = incremented['~core'].runtimeSteps
	const chainedSteps = chained['~core'].runtimeSteps

	expect(Object.isFrozen(initialSteps)).toBe(true)
	expect(Object.isFrozen(incrementedSteps)).toBe(true)
	expect(Object.isFrozen(chainedSteps)).toBe(true)
	expect(initialSteps).toHaveLength(0)
	expect(incrementedSteps).toHaveLength(1)
	expect(chainedSteps).toHaveLength(2)
	expect(() => incrementedSteps.push(chainedSteps[1])).toThrow(TypeError)
	expect(() => incrementedSteps.splice(0, 1)).toThrow(TypeError)

	expect(v.execute(1)).toEqual({ value: 1 })
	expect(incremented.execute(1)).toEqual({ value: 3 })
	expect(chained.execute(1)).toEqual({ value: 6 })
})
