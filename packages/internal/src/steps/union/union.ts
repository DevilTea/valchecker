import type { IsEqual } from 'type-fest'
import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, ExecutionSuccessResult, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

declare namespace Internal {
	type Branches = [Use<Valchecker>, ...Use<Valchecker>[]]

	type OpMode<B extends Branches> = (
		B[number] extends infer S
			? S extends Use<Valchecker>
				? InferOperationMode<S>
				: never
			: never
	) extends infer M extends OperationMode
		? IsEqual<M, 'sync'> extends true
			? 'sync'
			: 'maybe-async'
		: never

	type Output<B extends Branches> = B[number] extends infer S
		? S extends Use<Valchecker>
			? InferOutput<S>
			: never
		: never

	type Issue<B extends Branches> = B[number] extends infer S
		? S extends Use<Valchecker>
			? InferIssue<S>
			: never
		: never
}

type Meta = DefineStepMethodMeta<{
	Name: 'union'
	ExpectedCurrentValchecker: DefineExpectedValchecker
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value passes at least one of the provided branches and returns
	 * the first successful branch output.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, number, union } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, number, union] })
	 * const schema = v.union([v.string(), v.number()])
	 * const result = schema.execute('hello')
	 * // result.value: 'hello'
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - Issues from the branches if none pass.
	 */
	union: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	<B extends [Use<Valchecker>, ...Use<Valchecker>[]]>(
					branches: B,
				) => Next<
					{
						operationMode: Internal.OpMode<B>
						output: Internal.Output<B>
						issue: Internal.Issue<B>
					},
					this['CurrentValchecker']
				>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const union = implStepPlugin<PluginDef>({
	union: ({
		utils: { addSuccessStep, failure, isFailure },
		params: [branches],
	}) => {
		const branchExecutors = branches.map(branch => branch['~execute'])
		const len = branchExecutors.length

		addSuccessStep((value) => {
			const issues: AnyExecutionIssue[] = []

			const processBranchResult = (result: ExecutionResult): ExecutionSuccessResult<unknown> | null => {
				if (isFailure(result)) {
					for (const issue of result.issues)
						issues.push(issue)
					return null
				}
				return result
			}

			for (let i = 0; i < len; i++) {
				const branchResult = branchExecutors[i]!(value)

				if (isPromiseLike(branchResult)) {
					let chain = Promise.resolve(branchResult)
						.then(processBranchResult)
					for (let j = i + 1; j < len; j++) {
						const execute = branchExecutors[j]!
						chain = chain.then((successResult) => {
							if (successResult != null)
								return successResult
							return Promise.resolve(execute(value))
								.then(processBranchResult)
						})
					}
					return chain.then(successResult => successResult ?? failure(issues))
				}

				const successResult = processBranchResult(branchResult)
				if (successResult != null)
					return successResult
			}

			return failure(issues)
		})
	},
})
