import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { isoTimeSource } from './iso-time-source'

const isoTimePattern = new RegExp(String.raw`^${isoTimeSource}$`)

type Meta = DefineStepMethodMeta<{
	Name: 'isIsoTime'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isIsoTime:expected_iso_time', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is an ISO 8601 time of day in `HH:MM:SS` form
	 * with an optional fractional-seconds part and no time-zone. The field
	 * ranges (00-23, 00-59, 00-59) are part of the accepted shape.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isIsoTime, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isIsoTime] })
	 * const result = v.string().isIsoTime().execute('12:30:45')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isIsoTime:expected_iso_time'`: The string is not a valid ISO 8601 time.
	 */
	isIsoTime: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (options?: StepOptions<Meta['SelfIssue']>) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isIsoTime = implStepPlugin<PluginDef>({
	isIsoTime: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => isoTimePattern.test(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isIsoTime:expected_iso_time',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid ISO 8601 time.',
					}),
				))
	},
}, 'sync')
