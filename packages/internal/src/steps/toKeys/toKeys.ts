import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferOutput, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toKeys'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Map<any, any> }>
}>

interface PluginDef extends TStepPluginDef {
	toKeys: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? InferOutput<This> extends Map<infer Key, any>
			? () => Next<{ output: Key[] }, This>
			: never
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const toKeys = implStepPlugin<PluginDef>({
	toKeys: ({ utils: { addSuccessStep, success } }) => {
		addSuccessStep(value => success([...value.keys()]))
	},
}, 'sync')
