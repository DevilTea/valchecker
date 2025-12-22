import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toAsync'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ operationMode: 'sync' | 'maybe-async' }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts a sync or maybe-async operation into an async operation by wrapping the result in Promise.resolve.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, transform, toAsync } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, transform, toAsync] })
	 * const schema = v.string()
	 * 	.transform((x) => x.toUpperCase())
	 * 	.toAsync()
	 * const result = await schema.execute('hello')
	 * // result.value: 'HELLO'
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toAsync: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	() => Next<
					{
						operationMode: 'async'
					},
					this['CurrentValchecker']
				>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toAsync = implStepPlugin<PluginDef>({
	toAsync: ({
		utils: { addStep },
	}) => {
		addStep((lastResult) => {
			return Promise.resolve(lastResult)
		})
	},
})
