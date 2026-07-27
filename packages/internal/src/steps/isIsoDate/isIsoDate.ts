import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { isoCalendarDateSource } from './iso-calendar-date'

const isoDatePattern = new RegExp(`^${isoCalendarDateSource}$`)

type Meta = DefineStepMethodMeta<{
	Name: 'isIsoDate'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isIsoDate:expected_iso_date', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is an ISO 8601 calendar date in `YYYY-MM-DD`
	 * form. Beyond the shape it rejects impossible dates such as
	 * `2026-02-30`, using a `Date` round-trip rather than a regular
	 * expression alone.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isIsoDate, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isIsoDate] })
	 * const result = v.string().isIsoDate().execute('2026-07-23')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isIsoDate:expected_iso_date'`: The string is not a valid ISO 8601 date.
	 */
	isIsoDate: DefineStepMethod<
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
export const isIsoDate = implStepPlugin<PluginDef>({
	isIsoDate: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => isoDatePattern.test(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isIsoDate:expected_iso_date',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid ISO 8601 date.',
					}),
				))
	},
}, 'sync')
