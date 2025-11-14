import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferOutput, Next, TStepPluginDef } from '../../core'
import type { OverloadParametersAndReturnType } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toSplitted'
	ExpectedThis: DefineExpectedValchecker<{ output: string & { split: (...params: any[]) => string[] } }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Splits the string using the provided separator.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toSplitted } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toSplitted] })
	 * const schema = v.string().toSplitted(',')
	 * const result = schema.execute('a,b,c')
	 * // result.value: ['a', 'b', 'c']
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toSplitted: this['This'] extends Meta['ExpectedThis']
		?	OverloadParametersAndReturnType<InferOutput<this['This']>['split']> extends infer Tuple
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
export const toSplitted = implStepPlugin<PluginDef>({
	toSplitted: ({
		utils: { addSuccessStep, success },
		params,
	}) => {
		addSuccessStep((value) => {
			return success(value.split(...params))
		})
	},
})
