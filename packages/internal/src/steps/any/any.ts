import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { noop } from '../../shared'

type Meta = DefineStepMethodMeta<{
	Name: 'any'
	ExpectedThis: DefineExpectedValchecker
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Passes for any value. (No runtime check)
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, any } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [any] })
	 * const schema = v.any()
	 * const result = schema.execute('anything')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	any: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	() => Next<
					{
						output: any
					},
					this['This']
				>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const any = implStepPlugin<PluginDef>({
	any: noop,
})
