import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { noop } from '../../shared'

type Meta = DefineStepMethodMeta<{
	Name: 'as'
	ExpectedCurrentValchecker: DefineExpectedValchecker
}>

interface PluginDef extends TStepPluginDef {
/**
 * ### Description:
 * Casts the type of value to the specified type `T`. (Type Only)
 *
 * ---
 *
 * ### Example:
 * ```ts
 * import { createValchecker, as } from 'valchecker'
 *
 * const v = createValchecker({ steps: [as] })
 * const schema = v.as<string>()
 * const result = schema.execute(123) // won't produce an issue at runtime
 * // result.output is of type string, but value is 123 at runtime
 * ```
 *
 * ---
 *
 * ### Issues:
 * - None.
 */
	as: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	<T>() => Next<
					{
						output: T
					},
					this['CurrentValchecker']
				>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const as = implStepPlugin<PluginDef>({
	as: noop,
})
