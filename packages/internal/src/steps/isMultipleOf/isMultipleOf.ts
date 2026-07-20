import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type NumberIssue = ExecutionIssue<'isMultipleOf:expected_multiple_of', { target: 'number', value: number, divisor: number }>
	export type BigIntIssue = ExecutionIssue<'isMultipleOf:expected_multiple_of', { target: 'bigint', value: bigint, divisor: bigint }>
}

type Meta<T extends number | bigint> = DefineStepMethodMeta<{
	Name: 'isMultipleOf'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: T }>
	SelfIssue: T extends number ? Internal.NumberIssue : Internal.BigIntIssue
}>

const MAX_QUOTIENT_TOLERANCE = 1e-10

function isNumberMultipleOf(value: number, divisor: number): boolean {
	if (!Number.isFinite(value))
		return false

	const remainder = value % divisor
	if (remainder === 0)
		return true

	const quotient = value / divisor
	const nearestInteger = Math.round(quotient)
	const tolerance = Math.min(
		MAX_QUOTIENT_TOLERANCE,
		Number.EPSILON * Math.max(1, Math.abs(quotient)) * 8,
	)
	return Math.abs(quotient - nearestInteger) <= tolerance
}

interface PluginDef extends TStepPluginDef {
	isMultipleOf:
		| DefineStepMethod<Meta<number>, this['CurrentValchecker'] extends Meta<number>['ExpectedCurrentValchecker']
			? (divisor: number, options?: StepOptions<Internal.NumberIssue>) => Next<{ issue: Internal.NumberIssue }, this['CurrentValchecker']>
			: never>
		| DefineStepMethod<Meta<bigint>, this['CurrentValchecker'] extends Meta<bigint>['ExpectedCurrentValchecker']
			? (divisor: bigint, options?: StepOptions<Internal.BigIntIssue>) => Next<{ issue: Internal.BigIntIssue }, this['CurrentValchecker']>
			: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const isMultipleOf = implStepPlugin<PluginDef>({
	isMultipleOf: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [divisor, options] }) => {
		if (typeof divisor === 'bigint') {
			if (divisor === 0n)
				throw new TypeError('isMultipleOf() divisor must not be zero.')
		}
		else if (!Number.isFinite(divisor) || divisor === 0) {
			throw new TypeError('isMultipleOf() number divisor must be finite and non-zero.')
		}

		addSuccessStep((value) => {
			const matches = typeof value === 'bigint'
				? value % (divisor as bigint) === 0n
				: isNumberMultipleOf(value, divisor as number)
			return matches
				? success(value)
				: failure(createIssue({
						code: 'isMultipleOf:expected_multiple_of',
						payload: { target: typeof value === 'bigint' ? 'bigint' : 'number', value, divisor } as any,
						customMessage: options?.message,
						defaultMessage: `Expected a multiple of ${divisor}.`,
					}))
		})
	},
}, 'sync')