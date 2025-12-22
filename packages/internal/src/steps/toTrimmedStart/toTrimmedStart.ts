import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toTrimmedStart'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Trims whitespace from the beginning of the string.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toTrimmedStart } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toTrimmedStart] })
	 * const schema = v.string().toTrimmedStart()
	 * const result = schema.execute('  hello')
	 * // result.value: 'hello'
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toTrimmedStart: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	() => Next<undefined, this['CurrentValchecker']>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toTrimmedStart = implStepPlugin<PluginDef>({
	toTrimmedStart: ({
		utils: { addSuccessStep, success },
	}) => {
		addSuccessStep(value => success(value.trimStart()))
	},
})
