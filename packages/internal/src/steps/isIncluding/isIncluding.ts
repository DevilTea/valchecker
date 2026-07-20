import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type StringIssue = ExecutionIssue<'isIncluding:expected_including', { target: 'string', value: string, search: string, position: number | undefined }>
	export type ArrayIssue<Input extends any[] = any[]> = ExecutionIssue<'isIncluding:expected_including', { target: 'array', value: Input, expected: Input[number], fromIndex: number | undefined }>
	export type SetIssue<Input extends Set<any> = Set<any>> = ExecutionIssue<'isIncluding:expected_including', { target: 'set', value: Input, expected: Input extends Set<infer Item> ? Item : never }>
	export interface StringOptions extends StepOptions<StringIssue> { readonly position?: number | undefined }
	export interface ArrayOptions<Input extends any[]> extends StepOptions<ArrayIssue<Input>> { readonly fromIndex?: number | undefined }
}

type Meta = DefineStepMethodMeta<{
	Name: 'isIncluding'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string | any[] | Set<any> }>
	SelfIssue: Internal.StringIssue | Internal.ArrayIssue | Internal.SetIssue
}>

interface PluginDef extends TStepPluginDef {
	isIncluding:
		| DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends string
				? (search: string, options?: Internal.StringOptions) => Next<{ issue: Internal.StringIssue }, This>
				: never
			: never>
		| DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends infer Input extends any[]
				? (expected: Input[number], options?: Internal.ArrayOptions<Input>) => Next<{ issue: Internal.ArrayIssue<Input> }, This>
				: never
			: never>
		| DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends infer Input extends Set<any>
				? (
						expected: Input extends Set<infer Item> ? Item : never,
						options?: StepOptions<Internal.SetIssue<Input>>,
					) => Next<{ issue: Internal.SetIssue<Input> }, This>
				: never
			: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const isIncluding = implStepPlugin<PluginDef>({
	isIncluding: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [search, options] }) => {
		addSuccessStep((value) => {
			if (typeof value === 'string') {
				const position = (options as Internal.StringOptions | undefined)?.position
				return value.includes(search as string, position)
					? success(value)
					: failure(createIssue({
							code: 'isIncluding:expected_including',
							payload: { target: 'string', value, search, position },
							customMessage: options?.message,
							defaultMessage: `Expected the string to include "${search}".`,
						}))
			}

			if (Array.isArray(value)) {
				const fromIndex = (options as Internal.ArrayOptions<any[]> | undefined)?.fromIndex
				return value.includes(search, fromIndex)
					? success(value)
					: failure(createIssue({
							code: 'isIncluding:expected_including',
							payload: { target: 'array', value, expected: search, fromIndex },
							customMessage: options?.message,
							defaultMessage: 'Expected the array to include the configured value.',
						}))
			}

			return value.has(search)
				? success(value)
				: failure(createIssue({
						code: 'isIncluding:expected_including',
						payload: { target: 'set', value, expected: search },
						customMessage: options?.message,
						defaultMessage: 'Expected the Set to include the configured value.',
					}))
		})
	},
}, 'sync')
