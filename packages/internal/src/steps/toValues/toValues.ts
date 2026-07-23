import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferOutput, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toValues'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Map<any, any> }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Replaces a Map with a new array of its values in insertion order. This pure
	 * transformation does not mutate the source Map.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, map, number, string, toValues } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [map, number, string, toValues] })
	 * const schema = v.map({ key: v.string(), value: v.number() }).toValues()
	 * const result = schema.execute(new Map([['a', 1]]))
	 * // result.value: [1]
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toValues: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? InferOutput<This> extends Map<any, infer Value>
			? () => Next<{ output: Value[] }, This>
			: never
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const toValues = implStepPlugin<PluginDef>({
	toValues: ({ utils: { addSuccessStep, success } }) => {
		addSuccessStep(value => success([...value.values()]))
	},
}, 'sync')
