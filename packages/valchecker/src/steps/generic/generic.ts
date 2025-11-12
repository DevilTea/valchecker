import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, TStepPluginDef, Use, Valchecker } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'generic'
	ExpectedThis: DefineExpectedValchecker
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Adds a step from another others with specified generic type. **The type parameter `T` is required to be specified.**
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, array, generic, object } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [array, generic, object] })
	 *
	 * interface MyNode {
	 *   id: number
	 *   children?: MyNode[]
	 * }
	 *
	 * const nodeSchema = v.object({
	 *   id: v.number(),
	 *   // Required to use a factory function with specifying return type `any` to avoid circular type reference.
	 *   children: [v.array(v.generic<{ output: MyNode }>((): any => nodeSchema))],
	 * })
	 *
	 * const result = nodeSchema.execute({
	 *   id: 1,
	 *   children: [
	 *     { id: 2 },
	 *     { id: 3, children: [{ id: 4 }] },
	 *   ],
	 * })
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - Depends on the added step.
	 */
	generic: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			// Required to specify type parameter T.
			? <T extends { async?: boolean, output?: unknown, issue?: ExecutionIssue } = never>(
					step: NoInfer<Use<Valchecker>> | (() => NoInfer<Use<Valchecker>>)
				) => Next<T, this['This']>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const generic = implStepPlugin<PluginDef>({
	generic: ({
		utils: { addStep },
		params: [stepOrFactory],
	}) => {
		const step = typeof stepOrFactory === 'function' ? stepOrFactory() : stepOrFactory
		for (const s of step['~core'].runtimeSteps) {
			addStep(s)
		}
	},
})
