import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferOutput, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toEntries'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Map<any, any> }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Replaces a Map with a new array of mutable `[key, value]` tuples in insertion
	 * order. This pure transformation does not mutate the source Map.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, map, number, string, toEntries } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [map, number, string, toEntries] })
	 * const schema = v.map({ key: v.string(), value: v.number() }).toEntries()
	 * const result = schema.execute(new Map([['a', 1]]))
	 * // result.value: [['a', 1]]
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toEntries: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? InferOutput<This> extends Map<infer Key, infer Value>
			? () => Next<{ output: Array<[Key, Value]> }, This>
			: never
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const toEntries = implStepPlugin<PluginDef>({
	toEntries: ({ utils: { addSuccessStep, success } }) => {
		addSuccessStep(value => success([...value.entries()]))
	},
}, 'sync')
