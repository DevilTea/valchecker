import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toLength'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { length: number } }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Gets the length of the value.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, array, number, toLength } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [array, number, toLength] })
	 * const schema = v.array(v.number()).toLength()
	 * const result = schema.execute([1, 2, 3])
	 * // result.value: 3
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toLength: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	() => Next<{ output: number }, this['CurrentValchecker']>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toLength = implStepPlugin<PluginDef>({
	toLength: ({
		utils: { addSuccessStep, success },
	}) => {
		addSuccessStep((value) => {
			return success(value.length)
		})
	},
})
