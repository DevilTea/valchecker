import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'blob'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'blob:expected_blob', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a `Blob`. The global `Blob` constructor is
	 * feature-detected, so environments without it produce a
	 * `blob:expected_blob` failure instead of throwing. Note that every `File`
	 * is also a `Blob`.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { blob, createValchecker } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [blob] })
	 * const schema = v.blob()
	 * const result = schema.execute(new Blob(['data']))
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'blob:expected_blob'`: The value is not a `Blob`.
	 */
	blob: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				?	(options?: StepOptions<Meta['SelfIssue']>) => Next<
						{
							output: Blob
							issue: Meta['SelfIssue']
						},
						this['CurrentValchecker']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const blob = implStepPlugin<PluginDef>({
	blob: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(
			value => typeof Blob !== 'undefined' && value instanceof Blob
				?	success(value)
				:	failure(
						createIssue({
							code: 'blob:expected_blob',
							payload: { value },
							customMessage: options?.message,
							defaultMessage: 'Expected a Blob.',
						}),
					),
		)
	},
}, 'sync')
