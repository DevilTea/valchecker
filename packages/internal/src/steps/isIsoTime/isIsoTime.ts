import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { snapshotMessage } from '../../core/message'
import { isoTimeSource } from './iso-time-source'

type Meta = DefineStepMethodMeta<{
	Name: 'isIsoTime'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isIsoTime:expected_iso_time', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks the bounded ISO 8601 extended time profile: `HH:MM:SS`, optional
	 * fractional seconds using `.` or `,`, and no timezone. The special end-
	 * of-day form `24:00:00` is accepted, with only an all-zero fraction. Leap
	 * seconds, basic forms, and reduced precision are outside this API shape.
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
	 * - `'isIsoTime:expected_iso_time'`: The string does not match the supported ISO 8601 time-of-day profile.
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

const isoTimePattern = new RegExp(String.raw`^${isoTimeSource}$`)

/* @__NO_SIDE_EFFECTS__ */
export const isIsoTime = implStepPlugin<PluginDef>({
	isIsoTime: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const message = snapshotMessage(options?.message)
		addSuccessStep(value => isoTimePattern.test(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isIsoTime:expected_iso_time',
						payload: { value },
						customMessage: message,
						defaultMessage: 'Expected a supported ISO 8601 time of day.',
					}),
				))
	},
}, 'sync')
