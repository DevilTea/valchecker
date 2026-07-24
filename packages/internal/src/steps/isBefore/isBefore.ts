import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue = ExecutionIssue<'isBefore:expected_before', { value: Date, bound: Date }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isBefore'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Date }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that a `Date` is strictly before the configured bound, comparing
	 * `getTime()` values. The bound itself is rejected. Only a strict variant is
	 * provided; use `isBefore` with an adjusted bound when an inclusive edge is
	 * required.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, date, isBefore } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [date, isBefore] })
	 * const schema = v.date().isBefore(new Date('2020-01-02'))
	 * const result = schema.execute(new Date('2020-01-01'))
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isBefore:expected_before'`: The value is not before the bound.
	 */
	isBefore: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	(bound: Date, options?: StepOptions<Internal.Issue>) => Next<{ issue: Internal.Issue }, this['CurrentValchecker']>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isBefore = implStepPlugin<PluginDef>({
	isBefore: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [bound, options] }) => {
		const boundText = Number.isNaN(bound.getTime()) ? 'Invalid Date' : bound.toISOString()
		addSuccessStep(value => value.getTime() < bound.getTime()
			? success(value)
			: failure(createIssue({
					code: 'isBefore:expected_before',
					payload: { value, bound },
					customMessage: options?.message,
					defaultMessage: `Expected a date before ${boundText}.`,
				})))
	},
}, 'sync')
