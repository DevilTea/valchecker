import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferOutput, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toEntries'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Map<any, any> }>
}>

interface PluginDef extends TStepPluginDef {
	toEntries: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? InferOutput<This> extends Map<infer Key, infer Value>
			? () => Next<{ output: Array<[Key, Value]> }, This>
			: never
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const toEntries = implStepPlugin<PluginDef>({
	toEntries: ({ utils: { addSuccessStep, success } }) => {
		addSuccessStep(value => success([...value.entries()]))
	},
}, 'sync')
