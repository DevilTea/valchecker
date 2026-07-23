import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

function isCalendarDate(year: number, month: number, day: number): boolean {
	if (month < 1 || month > 12 || day < 1 || day > 31)
		return false
	const date = new Date(Date.UTC(year, month - 1, day))
	return date.getUTCFullYear() === year
		&& date.getUTCMonth() === month - 1
		&& date.getUTCDate() === day
}

function isIsoDateValue(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
	if (match === null)
		return false
	return isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
}

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
		addSuccessStep(value => isIsoDateValue(value)
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
