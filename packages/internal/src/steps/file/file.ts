import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'file'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'file:expected_file', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a `File`. The global `File` constructor is
	 * feature-detected, so environments without it (such as some server
	 * runtimes) produce a `file:expected_file` failure instead of throwing.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, file } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [file] })
	 * const schema = v.file()
	 * const result = schema.execute(new File(['data'], 'name.txt'))
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'file:expected_file'`: The value is not a `File`.
	 */
	file: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				?	(options?: StepOptions<Meta['SelfIssue']>) => Next<
						{
							output: File
							issue: Meta['SelfIssue']
						},
						this['CurrentValchecker']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const file = implStepPlugin<PluginDef>({
	file: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(
			value => typeof File !== 'undefined' && value instanceof File
				?	success(value)
				:	failure(
						createIssue({
							code: 'file:expected_file',
							payload: { value },
							customMessage: options?.message,
							defaultMessage: 'Expected a File.',
						}),
					),
		)
	},
}, 'sync')
