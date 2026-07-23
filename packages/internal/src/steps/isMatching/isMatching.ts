import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export interface PatternSnapshot { readonly source: string, readonly flags: string }
	export type Issue = ExecutionIssue<'isMatching:expected_matching', { value: string, pattern: PatternSnapshot }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isMatching'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string matches the regular expression. The pattern is cloned
	 * from its `source` and `flags` at construction, and `lastIndex` is reset to
	 * `0` before and after each test, so stateful `g` or `y` flags do not leak
	 * between executions. A non-RegExp pattern throws a `TypeError` while
	 * constructing the schema.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isMatching, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isMatching] })
	 * const schema = v.string().isMatching(/^\d+$/)
	 * const result = schema.execute('123')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isMatching:expected_matching'`: The value does not match the pattern.
	 */
	isMatching: DefineStepMethod<Meta, this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
		? (pattern: RegExp, options?: StepOptions<Internal.Issue>) => Next<{ issue: Internal.Issue }, this['CurrentValchecker']>
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const isMatching = implStepPlugin<PluginDef>({
	isMatching: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [pattern, options] }) => {
		if (!(pattern instanceof RegExp))
			throw new TypeError('isMatching() requires a RegExp pattern.')

		const patternSnapshot = Object.freeze({ source: pattern.source, flags: pattern.flags })
		const regex = new RegExp(patternSnapshot.source, patternSnapshot.flags)
		addSuccessStep((value) => {
			regex.lastIndex = 0
			const matches = regex.test(value)
			regex.lastIndex = 0
			return matches
				? success(value)
				: failure(createIssue({
						code: 'isMatching:expected_matching',
						payload: { value, pattern: patternSnapshot },
						customMessage: options?.message,
						defaultMessage: `Expected the string to match /${patternSnapshot.source}/${patternSnapshot.flags}.`,
					}))
		})
	},
}, 'sync')
