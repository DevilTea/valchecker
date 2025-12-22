import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toUppercase'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts the string to uppercase.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toUppercase } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toUppercase] })
	 * const schema = v.string().toUppercase()
	 * const result = schema.execute('hello')
	 * // result.value: 'HELLO'
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toUppercase: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	() => Next<undefined, this['CurrentValchecker']>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toUppercase = implStepPlugin<PluginDef>({
	toUppercase: ({
		utils: { addSuccessStep, success },
	}) => {
		addSuccessStep((value) => {
			return success(value.toUpperCase())
		})
	},
})
