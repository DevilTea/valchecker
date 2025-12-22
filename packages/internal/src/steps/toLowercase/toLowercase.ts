import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toLowercase'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts the string to lowercase.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toLowercase } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toLowercase] })
	 * const schema = v.string().toLowercase()
	 * const result = schema.execute('HELLO')
	 * // result.value: 'hello'
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toLowercase: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	() => Next<undefined, this['CurrentValchecker']>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toLowercase = implStepPlugin<PluginDef>({
	toLowercase: ({
		utils: { addSuccessStep, success },
	}) => {
		addSuccessStep((value) => {
			return success(value.toLowerCase())
		})
	},
})
