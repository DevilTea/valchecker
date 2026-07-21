import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { withExecutionEffects } from '../../core/execution-effects'

type Meta = DefineStepMethodMeta<{
	Name: 'number'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'number:expected_number', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a JavaScript number. This matches the TypeScript `number` type and therefore accepts `NaN`, `Infinity`, and `-Infinity`.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, number } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [number] })
	 * const schema = v.number()
	 * const result = schema.execute(42)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'number:expected_number'`: The value is not a number.
	 */
	number: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? (options?: StepOptions<Meta['SelfIssue']>) => Next<
						{
							output: number
							issue: Meta['SelfIssue']
						},
						this['CurrentValchecker']
					>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const number = withExecutionEffects(implStepPlugin<PluginDef>({
	number: ({
		utils,
		params: [options],
	}) => {
		const { addSuccessStep, success, createIssue, failure } = utils
		addSuccessStep((value) => {
			if (typeof value === 'number') {
				return success(value)
			}
			return failure(
				createIssue({
					code: 'number:expected_number',
					payload: { value },
					customMessage: options?.message,
					defaultMessage: 'Expected a number.',
				}),
			)
		})
	},
}, 'sync'), { number: previous => previous })
