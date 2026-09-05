import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { snapshotMessage } from '../../core/message'
import { isoCalendarDateSource } from '../isIsoDate/iso-calendar-date'
import { isoTimeSource, isoUtcOffsetSource } from '../isIsoTime/iso-time-source'

type Meta = DefineStepMethodMeta<{
	Name: 'isIsoDateTime'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isIsoDateTime:expected_iso_date_time', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks the bounded ISO 8601 extended calendar date-time profile:
	 * `YYYY-MM-DDTHH:MM:SS`, optional fractional seconds using `.` or `,`,
	 * and an optional `Z` or `±HH:MM` offset. Calendar validity, year `0000`,
	 * and valid end-of-day `24:00:00` forms are supported. Leap seconds and
	 * other ISO representation families remain outside this API shape.
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
	 * - `'isIsoDateTime:expected_iso_date_time'`: The string does not match the supported ISO 8601 extended calendar date-time profile.
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

// The calendar, time-of-day, and offset grammars are shared with their owning
// steps. Time-of-day and offset remain semantically separate so accepting the
// end-of-day hour 24 can never make `+24:00` a valid UTC offset.
const isoDateTimePattern = new RegExp(String.raw`^${isoCalendarDateSource}T${isoTimeSource}(?:Z|[+-]${isoUtcOffsetSource})?$`)

/* @__NO_SIDE_EFFECTS__ */
export const isIsoDateTime = implStepPlugin<PluginDef>({
	isIsoDateTime: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const message = snapshotMessage(options?.message)
		addSuccessStep(value => isoDateTimePattern.test(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isIsoDateTime:expected_iso_date_time',
						payload: { value },
						customMessage: message,
						defaultMessage: 'Expected a supported ISO 8601 calendar date-time.',
					}),
				))
	},
}, 'sync')
