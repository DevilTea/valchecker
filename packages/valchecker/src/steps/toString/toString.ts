import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferOutput, Next, TStepPluginDef } from '../../core'
import type { OverloadParametersAndReturnType } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toString'
	ExpectedThis: DefineExpectedValchecker<{ output: { toString: (...params: any[]) => string } }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts the value to a string using its toString method.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, number, toString } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [number, toString] })
	 * const schema = v.number().toString()
	 * const result = schema.execute(42)
	 * // result.value: '42'
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toString: this['This'] extends Meta['ExpectedThis']
		?	OverloadParametersAndReturnType<InferOutput<this['This']>['toString']> extends infer Tuple
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
export const toString = implStepPlugin<PluginDef>({
	toString: ({
		utils: { addSuccessStep, success },
		params,
	}) => {
		addSuccessStep((value) => {
			return success(value.toString(...params))
		})
	},
})
