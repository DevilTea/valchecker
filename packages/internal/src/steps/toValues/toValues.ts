import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferOutput, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toValues'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Map<any, any> }>
}>

interface PluginDef extends TStepPluginDef {
	toValues: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? InferOutput<This> extends Map<any, infer Value>
			? () => Next<{ output: Value[] }, This>
			: never
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const toValues = implStepPlugin<PluginDef>({
	toValues: ({ utils: { addSuccessStep, success } }) => {
		addSuccessStep(value => success([...value.values()]))
	},
}, 'sync')
