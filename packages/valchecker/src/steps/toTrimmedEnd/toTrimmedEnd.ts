import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toTrimmedEnd'
	ExpectedThis: DefineExpectedValchecker<{ output: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Trims whitespace from the end of the string.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toTrimmedEnd } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toTrimmedEnd] })
	 * const schema = v.string().toTrimmedEnd()
	 * const result = schema.execute('hello  ')
	 * // result.value: 'hello'
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toTrimmedEnd: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	() => Next<undefined, this['This']>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toTrimmedEnd = implStepPlugin<PluginDef>({
	toTrimmedEnd: ({
		utils: { addSuccessStep, success },
	}) => {
		addSuccessStep(value => success(value.trimEnd()))
	},
})
