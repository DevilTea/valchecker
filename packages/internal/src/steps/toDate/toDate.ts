import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toDate'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string | number }>
	SelfIssue: ExecutionIssue<'toDate:conversion_failed', { value: unknown, error: unknown }, 'operation'>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts a `number` (epoch milliseconds) or ISO `string` to a `Date` with
	 * `new Date(value)`.
	 *
	 * A native exception, or a result that is an Invalid Date (`getTime()` is
	 * `NaN`, such as from an unparseable string), becomes a
	 * `'toDate:conversion_failed'` `'operation'` issue. The payload `error` holds
	 * the thrown exception when the native conversion threw, and is `undefined`
	 * when the conversion produced an Invalid Date.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toDate } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toDate] })
	 * const result = v.string().toDate().execute('2020-01-01')
	 * // { value: Date }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toDate:conversion_failed'`: `new Date(value)` threw or produced an Invalid Date.
	 *   Payload: `{ value, error }`.
	 */
	toDate: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? (options?: StepOptions<Meta['SelfIssue']>) => Next<{
					output: Date
					issue: Meta['SelfIssue']
				}, This>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toDate = implStepPlugin<PluginDef>({
	toDate: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep((value) => {
			try {
				const date = new Date(value as string | number)
				if (Number.isNaN(date.getTime())) {
					return failure(createIssue({
						code: 'toDate:conversion_failed',
						category: 'operation',
						payload: { value, error: undefined },
						customMessage: options?.message,
						defaultMessage: 'Expected a value convertible to a valid Date.',
					}))
				}

				return success(date)
			}
			catch (error) {
				return failure(createIssue({
					code: 'toDate:conversion_failed',
					category: 'operation',
					payload: { value, error },
					customMessage: options?.message,
					defaultMessage: 'Expected a value convertible to a valid Date.',
				}))
			}
		})
	},
}, 'sync')
