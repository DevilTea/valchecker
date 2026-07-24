import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type ExpectedIssue = ExecutionIssue<'date:expected_date', { value: unknown }>
	export type InvalidIssue = ExecutionIssue<'date:invalid_date', { value: Date }>
	export type Issue = ExpectedIssue | InvalidIssue
}

type Meta = DefineStepMethodMeta<{
	Name: 'date'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a `Date` instance and rejects an Invalid Date
	 * (a `Date` whose `getTime()` is `NaN`, such as `new Date('nope')`).
	 *
	 * Unlike `instance(Date)`, this schema also rejects Invalid Date and emits
	 * its own `date:*` issues instead of `instance:expected_instance`.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, date } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [date] })
	 * const schema = v.date()
	 * const result = schema.execute(new Date())
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'date:expected_date'`: The value is not a `Date` instance.
	 * - `'date:invalid_date'`: The value is a `Date` but represents an Invalid Date.
	 */
	date: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				?	(options?: StepOptions<Internal.Issue>) => Next<
						{
							output: Date
							issue: Internal.Issue
						},
						this['CurrentValchecker']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const date = implStepPlugin<PluginDef>({
	date: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep((value) => {
			if (!(value instanceof Date)) {
				return failure(
					createIssue({
						code: 'date:expected_date',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a Date.',
					}),
				)
			}

			if (Number.isNaN(value.getTime())) {
				return failure(
					createIssue({
						code: 'date:invalid_date',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid Date.',
					}),
				)
			}

			return success(value)
		})
	},
}, 'sync')
