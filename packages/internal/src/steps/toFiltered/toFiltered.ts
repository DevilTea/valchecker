import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferOutput, Next, TStepPluginDef } from '../../core'
import type { OverloadParametersAndReturnType } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toFiltered'
	ExpectedThis: DefineExpectedValchecker<{ output: any[] & { filter: (...params: any[]) => any } }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Filters the array using the provided predicate function.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, array, number, toFiltered } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [array, number, toFiltered] })
	 * const schema = v.array(v.number()).toFiltered((n) => n > 5)
	 * const result = schema.execute([1, 6, 3, 8])
	 * // result.value: [6, 8]
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toFiltered: this['This'] extends Meta['ExpectedThis']
		?	OverloadParametersAndReturnType<InferOutput<this['This']>['filter']> extends infer Tuple
			?	Tuple extends [params: any[], ret: any]
				?	DefineStepMethod<
					Meta,
					(...params: Tuple[0]) => Next<{ output: Tuple[1] }, this['This']>
				>
				:	never
			:	never
		:	never
}

/* @__NO_SIDE_EFFECTS__ */
export const toFiltered = implStepPlugin<PluginDef>({
	toFiltered: ({
		utils: { addSuccessStep, success },
		params,
	}) => {
		addSuccessStep((value) => {
			return success(value.filter(...params))
		})
	},
})
