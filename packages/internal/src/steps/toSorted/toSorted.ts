import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferOutput, Next, TStepPluginDef } from '../../core'
import type { OverloadParametersAndReturnType } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toSorted'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: any[] & { toSorted: (...params: any[]) => any } }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Sorts the array using the provided compare function.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, array, number, toSorted } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [array, number, toSorted] })
	 * const schema = v.array(v.number()).toSorted((a, b) => a - b)
	 * const result = schema.execute([3, 1, 4, 2])
	 * // result.value: [1, 2, 3, 4]
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toSorted: this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
		?	OverloadParametersAndReturnType<InferOutput<this['CurrentValchecker']>['toSorted']> extends infer Tuple
			?	Tuple extends [params: any[], ret: any]
				?	DefineStepMethod<
					Meta,
					(...params: Tuple[0]) => Next<{ output: Tuple[1] }, this['CurrentValchecker']>
				>
				:	never
			:	never
		:	never
}

/* @__NO_SIDE_EFFECTS__ */
export const toSorted = implStepPlugin<PluginDef>({
	toSorted: ({
		utils: { addSuccessStep, success },
		params,
	}) => {
		addSuccessStep((value) => {
			return success(value.toSorted(...params))
		})
	},
})
