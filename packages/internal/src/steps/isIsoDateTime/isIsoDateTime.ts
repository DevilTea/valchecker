import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { isoCalendarDateSource } from '../isIsoDate/iso-calendar-date'

// Time and offset ranges are part of the same pattern: an hour, minute, second,
// optional fractional seconds, and an optional `Z` or `±HH:MM` offset.
const isoDateTimePattern = new RegExp(String.raw`^${isoCalendarDateSource}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$`)

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
	 * `Z` or `±HH:MM` time-zone offset. Impossible calendar dates such as
	 * `2026-02-30`, and out-of-range time or offset fields such as `24:00:00`,
	 * are rejected: the calendar and the field ranges are both part of the
	 * accepted shape.
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
		addSuccessStep(value => isoDateTimePattern.test(value)
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
