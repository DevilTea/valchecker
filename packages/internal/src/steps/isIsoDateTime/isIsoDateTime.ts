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

function isIsoDateTimeValue(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(value)
	if (match === null)
		return false
	if (!isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3])))
		return false
	if (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59)
		return false
	const offset = match[7]
	if (offset !== undefined && offset !== 'Z') {
		if (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4, 6)) > 59)
			return false
	}
	return true
}

type Meta = DefineStepMethodMeta<{
	Name: 'isIsoDateTime'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isIsoDateTime:expected_iso_date_time', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is an ISO 8601 date-time: a calendar date and
	 * time joined by `T`, with optional fractional seconds and an optional
	 * `Z` or `±HH:MM` time-zone offset. Impossible calendar dates and
	 * out-of-range time or offset fields are rejected via a `Date`
	 * round-trip, not by shape alone.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isIsoDateTime, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isIsoDateTime] })
	 * const result = v.string().isIsoDateTime().execute('2026-07-23T12:30:00Z')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isIsoDateTime:expected_iso_date_time'`: The string is not a valid ISO 8601 date-time.
	 */
	isIsoDateTime: DefineStepMethod<
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
export const isIsoDateTime = implStepPlugin<PluginDef>({
	isIsoDateTime: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => isIsoDateTimeValue(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isIsoDateTime:expected_iso_date_time',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid ISO 8601 date-time.',
					}),
				))
	},
}, 'sync')
