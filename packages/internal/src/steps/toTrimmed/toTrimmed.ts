import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toTrimmed'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Trims whitespace from the beginning and end of the string.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toTrimmed } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toTrimmed] })
	 * const schema = v.string().toTrimmed()
	 * const result = schema.execute('  hello  ')
	 * // result.value: 'hello'
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toTrimmed: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	() => Next<undefined, this['CurrentValchecker']>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toTrimmed = implStepPlugin<PluginDef>({
	toTrimmed: ({
		utils: { addSuccessStep, success },
	}) => {
		addSuccessStep(value => success(value.trim()))
	},
})
