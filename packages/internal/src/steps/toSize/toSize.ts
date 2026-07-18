import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toSize'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { size: number } }>
}>

interface PluginDef extends TStepPluginDef {
	toSize: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? () => Next<{ output: number }, This>
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const toSize = implStepPlugin<PluginDef>({
	toSize: ({ utils: { addSuccessStep, success } }) => {
		addSuccessStep(value => success(value.size))
	},
})
