import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { noop } from '../../shared'

type Meta = DefineStepMethodMeta<{
	Name: 'unknown'
	ExpectedThis: DefineExpectedValchecker
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Passes for any value. (Output type is `unknown`)
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, unknown } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [unknown] })
	 * const schema = v.unknown()
	 * const result = schema.execute('anything')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	unknown: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	() => Next<
					{
						output: unknown
					},
					this['This']
				>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const unknown = implStepPlugin<PluginDef>({
	unknown: noop,
})
