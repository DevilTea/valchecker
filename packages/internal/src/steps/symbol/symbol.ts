import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'symbol'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'symbol:expected_symbol', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a symbol.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, symbol } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [symbol] })
	 * const schema = v.symbol()
	 * const result = schema.execute(Symbol('test'))
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'symbol:expected_symbol'`: The value is not a symbol.
	 */
	symbol: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				?	(message?: MessageHandler<Meta['SelfIssue']>) => Next<
						{
							output: symbol
							issue: Meta['SelfIssue']
						},
						this['CurrentValchecker']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const symbol = implStepPlugin<PluginDef>({
	symbol: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep(
			value => typeof value === 'symbol'
				?	success(value)
				:	failure(
						createIssue({
							code: 'symbol:expected_symbol',
							payload: { value },
							customMessage: message,
							defaultMessage: 'Expected a symbol.',
						}),
					),
		)
	},
})
