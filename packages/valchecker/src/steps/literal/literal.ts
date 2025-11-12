import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type LiteralType = bigint | boolean | number | string | symbol

	export type Issue<L extends LiteralType = LiteralType> = ExecutionIssue<'literal:expected_literal', { value: unknown, expected: L }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'literal'
	ExpectedThis: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value equals the specified literal value.
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
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'literal:expected_literal'`: The value does not match the expected literal.
	 */
	literal: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	IsExactlyAnyOrUnknown<InferOutput<this['This']>> extends true
				?	<L extends Internal.LiteralType>(value: L, message?: MessageHandler<Internal.Issue<L>>) => Next<
						{
							output: L
							issue: Internal.Issue<L>
						},
						this['This']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const literal = implStepPlugin<PluginDef>({
	literal: ({
		utils: { addSuccessStep, success, resolveMessage, failure },
		params: [literalValue, message],
	}) => {
		addSuccessStep(
			value => value === literalValue
				?	success(value as typeof literalValue)
				:	failure({
						code: 'literal:expected_literal',
						payload: { value, expected: literalValue },
						message: resolveMessage(
							{
								code: 'literal:expected_literal',
								payload: { value, expected: literalValue },
							},
							message,
							`Expected literal value "${String(literalValue)}".`,
						),
					}),
		)
	},
})
