import type { Class } from 'type-fest'
import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<T extends Class<any> = Class<any>> = ExecutionIssue<'instance:expected_instance', { value: unknown, expected: T }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'instance'
	ExpectedThis: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is an instance of the specified class.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, instance } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [instance] })
	 * const schema = v.instance(Date)
	 * const result = schema.execute(new Date())
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'instance:expected_instance'`: The value is not an instance of the expected class.
	 */
	instance: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	IsExactlyAnyOrUnknown<InferOutput<this['This']>> extends true
				?	<C extends Class<any>>(class_: C, message?: MessageHandler<Internal.Issue<C>>) => Next<
						{
							output: InstanceType<C>
							issue: Internal.Issue<C>
						},
						this['This']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const instance = implStepPlugin<PluginDef>({
	instance: ({
		utils: { addSuccessStep, success, resolveMessage, failure },
		params: [class_, message],
	}) => {
		addSuccessStep(
			value => value instanceof class_
				?	success(value)
				:	failure({
						code: 'instance:expected_instance',
						payload: { value, expected: class_ },
						message: resolveMessage(
							{
								code: 'instance:expected_instance',
								payload: { value, expected: class_ },
							},
							message,
							`Expected instance of ${class_.name}.`,
						),
					}),
		)
	},
})
