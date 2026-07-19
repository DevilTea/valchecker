import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferOutput, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toArray'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Set<any> }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Returns Set items as a new array in insertion order.
	 *
	 * @example `v.set(v.string()).toArray()`
	 */
	toArray: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? InferOutput<This> extends Set<infer Item>
			? () => Next<{ output: Item[] }, This>
			: never
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const toArray = implStepPlugin<PluginDef>({
	toArray: ({ utils: { addSuccessStep, success } }) => {
		addSuccessStep(value => success([...value]))
	},
})
