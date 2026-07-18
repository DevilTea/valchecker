import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import type { HasRegisteredPlugin } from '../union/union-shorthand'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type LiteralType = bigint | boolean | number | string | symbol
	export type Issue<L extends LiteralType = LiteralType> = ExecutionIssue<'literal:expected_literal', { value: unknown, expected: L }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'literal'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

declare const literalPluginDefBrand: unique symbol

interface PluginDef extends TStepPluginDef {
	readonly [literalPluginDefBrand]: true
	/**
	 * ### Description:
	 * Checks that the value matches the specified literal with `Object.is`.
	 * This means `NaN` matches `NaN`, while `0` and `-0` are distinct.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, literal } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [literal] })
	 * const schema = v.literal('hello')
	 * const result = schema.execute('hello')
	 * // { value: 'hello' }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'literal:expected_literal'`: The value does not match the expected literal.
	 *   Payload: `{ value, expected }`.
	 */
	literal: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? <L extends Internal.LiteralType>(value: L, options?: StepOptions<Internal.Issue<L>>) => Next<{
						output: L
						issue: Internal.Issue<L>
					}, this['CurrentValchecker']>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const literal = implStepPlugin<PluginDef>({
	literal: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [literalValue, options],
	}) => {
		addSuccessStep(value => Object.is(value, literalValue)
			? success(value as typeof literalValue)
			: failure(createIssue({
					code: 'literal:expected_literal',
					payload: { value, expected: literalValue },
					customMessage: options?.message,
					defaultMessage: `Expected literal value "${String(literalValue)}".`,
				})))
	},
})

declare module '../union/union-shorthand' {
	interface UnionShorthandInputRegistry<Registered extends TStepPluginDef> {
		literal: HasRegisteredPlugin<Registered, PluginDef> extends true
			? Internal.LiteralType
			: never
	}

	interface UnionShorthandResultRegistry<Registered extends TStepPluginDef, Branch> {
		literal: HasRegisteredPlugin<Registered, PluginDef> extends true
			? Branch extends Internal.LiteralType
				? {
					operationMode: 'sync'
					output: Branch
					issue: Internal.Issue<Branch>
				}
				: never
			: never
	}
}
