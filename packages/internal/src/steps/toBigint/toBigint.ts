import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toBigint'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'toBigint:conversion_failed', { value: unknown, error: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	toBigint: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends bigint
				? never
				: (message?: MessageHandler<Meta['SelfIssue']>) => Next<{
					output: bigint
					issue: Meta['SelfIssue']
				}, This>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toBigint = implStepPlugin<PluginDef>({
	toBigint: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep((value) => {
			try {
				return success(BigInt(value))
			}
			catch (error) {
				return failure(createIssue({
					code: 'toBigint:conversion_failed',
					payload: { value, error },
					customMessage: message,
					defaultMessage: 'Expected a value convertible to bigint.',
				}))
			}
		})
	},
})
