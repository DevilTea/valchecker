import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferOutput, Next, TStepPluginDef } from '../../core'
import type { OverloadParametersAndReturnType } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toSplit'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string & { split: (...params: any[]) => string[] } }>
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
	 * import { createValchecker, string, toSplit } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toSplit] })
	 * const schema = v.string().toSplit(',')
	 * const result = schema.execute('a,b,c')
	 * // result.value: ['a', 'b', 'c']
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toSplit: this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
		? OverloadParametersAndReturnType<InferOutput<this['CurrentValchecker']>['split']> extends infer Tuple
			? Tuple extends [params: any[], ret: any]
				? DefineStepMethod<
					Meta,
					(...params: Tuple[0]) => Next<{ output: Tuple[1] }, this['CurrentValchecker']>
				>
				: never
			: never
		: never
}

/* @__NO_SIDE_EFFECTS__ */
export const toSplit = implStepPlugin<PluginDef>({
	toSplit: ({
		utils: { addSuccessStep, success },
		params,
	}) => {
		addSuccessStep(value => success(value.split(...params)))
	},
}, 'sync')
