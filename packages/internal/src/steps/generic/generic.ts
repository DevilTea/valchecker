import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import { executeRuntimeSteps, implStepPlugin } from '../../core/core'

type Meta = DefineStepMethodMeta<{
	Name: 'generic'
	ExpectedCurrentValchecker: DefineExpectedValchecker
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
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			// Required to specify type parameter T.
			? <T extends { operationMode?: OperationMode, output?: unknown, issue?: AnyExecutionIssue } = never>(
					step: NoInfer<Use<Valchecker>> | (() => NoInfer<Use<Valchecker>>),
				) => Next<T, this['CurrentValchecker']>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const generic = implStepPlugin<PluginDef>({
	generic: ({
		utils: { addStep },
		params: [stepOrFactory],
	}) => {
		// Handle factory function. The sub-schema is resolved lazily on each
		// execution, so the parent mode stays conservatively maybe-async and the
		// shared core loop runs the resolved steps over the current result.
		if (typeof stepOrFactory === 'function') {
			addStep(lastResult => executeRuntimeSteps(stepOrFactory()['~core'].runtimeSteps, lastResult), 'maybe-async')
		}
		// Handle direct step
		else {
			const runtimeSteps = stepOrFactory['~core'].runtimeSteps
			const operationMode = stepOrFactory['~core'].operationMode ?? 'maybe-async'
			const len = runtimeSteps.length
			for (let i = 0; i < len; i++) {
				addStep(runtimeSteps[i]!, operationMode)
			}
		}
	},
})
