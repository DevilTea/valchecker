import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferOutput, Next, TStepPluginDef } from '../../core'
import type { OverloadParametersAndReturnType } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toSliced'
	ExpectedThis: DefineExpectedValchecker<{ output: { slice: (...params: any[]) => any } }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Slices the value using the provided start and end indices.
	 *
	 * ---
	 *
	 * ### Example:
	 * #### Array slicing
	 * ```ts
	 * import { createValchecker, array, number, toSliced } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [array, number, toSliced] })
	 * const schema = v.array(v.number()).toSliced(1, 3)
	 * const result = schema.execute([1, 2, 3, 4])
	 * // result.value: [2, 3]
	 * ```
	 *
	 * #### String slicing
	 * ```ts
	 * import { createValchecker, string, toSliced } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toSliced] })
	 * const schema = v.string().toSliced(1, 4)
	 * const result = schema.execute('Hello, world!')
	 * // result.value: 'ell'
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toSliced: this['This'] extends Meta['ExpectedThis']
		?	OverloadParametersAndReturnType<InferOutput<this['This']>['slice']> extends infer Tuple
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
export const toSliced = implStepPlugin<PluginDef>({
	toSliced: ({
		utils: { addSuccessStep, success },
		params,
	}) => {
		addSuccessStep((value) => {
			return success(value.slice(...params))
		})
	},
})
