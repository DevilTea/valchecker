import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue = ExecutionIssue<'isAfter:expected_after', { value: Date, bound: Date }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isAfter'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Date }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that a `Date` is strictly after the configured bound, comparing
	 * `getTime()` values. The bound itself is rejected. Only a strict variant is
	 * provided; use `isAfter` with an adjusted bound when an inclusive edge is
	 * required.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, date, isAfter } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [date, isAfter] })
	 * const schema = v.date().isAfter(new Date('2020-01-01'))
	 * const result = schema.execute(new Date('2020-01-02'))
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isAfter:expected_after'`: The value is not after the bound.
	 */
	isAfter: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	(bound: Date, options?: StepOptions<Internal.Issue>) => Next<{ issue: Internal.Issue }, this['CurrentValchecker']>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isAfter = implStepPlugin<PluginDef>({
	isAfter: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [bound, options] }) => {
		addSuccessStep(value => value.getTime() > bound.getTime()
			? success(value)
			: failure(createIssue({
					code: 'isAfter:expected_after',
					payload: { value, bound },
					customMessage: options?.message,
					defaultMessage: `Expected a date after ${bound.toISOString()}.`,
				})))
	},
}, 'sync')
