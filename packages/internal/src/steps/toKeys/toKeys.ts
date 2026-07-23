import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferOutput, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toKeys'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Map<any, any> }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Replaces a Map with a new array of its keys in insertion order. This pure
	 * transformation does not mutate the source Map.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, map, number, string, toKeys } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [map, number, string, toKeys] })
	 * const schema = v.map({ key: v.string(), value: v.number() }).toKeys()
	 * const result = schema.execute(new Map([['a', 1]]))
	 * // result.value: ['a']
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toKeys: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? InferOutput<This> extends Map<infer Key, any>
			? () => Next<{ output: Key[] }, This>
			: never
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const toKeys = implStepPlugin<PluginDef>({
	toKeys: ({ utils: { addSuccessStep, success } }) => {
		addSuccessStep(value => success([...value.keys()]))
	},
}, 'sync')
