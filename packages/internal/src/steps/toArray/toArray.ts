import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferOutput, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toArray'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Set<any> }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Replaces a Set with a new array of its items in insertion order. This pure
	 * transformation does not mutate the source Set.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, set, string, toArray } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [set, string, toArray] })
	 * const schema = v.set(v.string()).toArray()
	 * const result = schema.execute(new Set(['b', 'a']))
	 * // result.value: ['b', 'a']
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toArray: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? InferOutput<This> extends Set<infer Item>
			? () => Next<{ output: Item[] }, This>
			: never
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const toArray = implStepPlugin<PluginDef>({
	toArray: ({ utils: { addSuccessStep, success } }) => {
		addSuccessStep(value => success([...value]))
	},
}, 'sync')
