import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toNumber'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string | boolean | bigint }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts the current value with JavaScript's native `Number()` coercion.
	 *
	 * This step does not add finite-number, parsing, or precision-safety constraints. Values such as invalid numeric strings produce `NaN`, and large bigint values may lose precision, exactly as they do with `Number(value)`.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toNumber } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toNumber] })
	 * const result = v.string().toNumber().execute('42')
	 * // { value: 42 }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toNumber: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? () => Next<{ output: number }, this['CurrentValchecker']>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toNumber = implStepPlugin<PluginDef>({
	toNumber: ({
		utils: { addSuccessStep, success },
	}) => {
		addSuccessStep((value) => {
			return success(Number(value))
		})
	},
})
