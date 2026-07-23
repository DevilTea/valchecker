import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toSize'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { size: number } }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Replaces a size-bearing value such as a Map or Set with its numeric `size`.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, set, string, toSize } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [set, string, toSize] })
	 * const schema = v.set(v.string()).toSize()
	 * const result = schema.execute(new Set(['a', 'b']))
	 * // result.value: 2
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toSize: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? () => Next<{ output: number }, This>
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const toSize = implStepPlugin<PluginDef>({
	toSize: ({ utils: { addSuccessStep, success } }) => {
		addSuccessStep(value => success(value.size))
	},
}, 'sync')
