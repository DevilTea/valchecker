import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { snapshotMessageOptions } from '../../core/message'
import { isoCalendarDateSource } from './iso-calendar-date'

type Meta = DefineStepMethodMeta<{
	Name: 'isIsoDate'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isIsoDate:expected_iso_date', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks the bounded ISO 8601 extended-calendar date profile: exactly
	 * `YYYY-MM-DD`. Month lengths and the proleptic Gregorian leap-year rule
	 * are enforced, including year `0000`. Basic, week, ordinal, reduced-
	 * precision, and expanded-year representations are outside this API shape.
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
	 * - `'isIsoDate:expected_iso_date'`: The string does not match the supported ISO 8601 calendar-date profile.
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

const isoDatePattern = new RegExp(String.raw`^${isoCalendarDateSource}$`)

/* @__NO_SIDE_EFFECTS__ */
export const isIsoDate = implStepPlugin<PluginDef>({
	isIsoDate: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const messageOptions = snapshotMessageOptions(options)
		addSuccessStep(value => isoDatePattern.test(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isIsoDate:expected_iso_date',
						payload: { value },
						customMessage: messageOptions?.message,
						defaultMessage: 'Expected a supported ISO 8601 calendar date.',
					}),
				))
	},
}, 'sync')
