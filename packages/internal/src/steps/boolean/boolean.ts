import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { PRESERVE_EXECUTION_EFFECTS, withExecutionEffects } from '../../core/execution-effects'

type Meta = DefineStepMethodMeta<{
	Name: 'boolean'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'boolean:expected_boolean', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a boolean.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, boolean } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [boolean] })
	 * const schema = v.boolean()
	 * const result = schema.execute(true)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'boolean:expected_boolean'`: The value is not a boolean.
	 */
	boolean: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				?	(options?: StepOptions<Meta['SelfIssue']>) => Next<
						{
							output: boolean
							issue: Meta['SelfIssue']
						},
						this['CurrentValchecker']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const boolean = /* @__PURE__ */ withExecutionEffects(implStepPlugin<PluginDef>({
	boolean: ({
		utils,
		params: [options],
	}) => {
		const { addSuccessStep, success, createIssue, failure } = utils
		addSuccessStep(
			value => typeof value === 'boolean'
				?	success(value)
				:	failure(
						createIssue({
							code: 'boolean:expected_boolean',
							payload: { value },
							customMessage: options?.message,
							defaultMessage: 'Expected a boolean.',
						}),
					),
		)
	},
}, 'sync'), { boolean: PRESERVE_EXECUTION_EFFECTS })
