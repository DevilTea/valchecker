import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toBoolean'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string | number | bigint }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts the current value with JavaScript's native `Boolean()` truthiness coercion.
	 *
	 * This step does not parse semantic boolean representations. For example, the non-empty strings `"false"`, `"0"`, and `"no"` all convert to `true`.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toBoolean } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toBoolean] })
	 * const result = v.string().toBoolean().execute('false')
	 * // { value: true }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toBoolean: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? () => Next<{ output: boolean }, this['CurrentValchecker']>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toBoolean = implStepPlugin<PluginDef>({
	toBoolean: ({
		utils: { addSuccessStep, success },
	}) => {
		addSuccessStep((value) => {
			return success(Boolean(value))
		})
	},
})
