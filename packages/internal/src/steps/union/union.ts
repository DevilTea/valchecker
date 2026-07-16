import type { IsEqual } from 'type-fest'
import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
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
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const union = implStepPlugin<PluginDef>({
	union: ({
		utils: { addSuccessStep, failure },
		params: [branches],
	}) => {
		const branchExecutors = branches.map(branch => branch['~execute'])
		const len = branchExecutors.length

		const continueAsync = async (
			value: unknown,
			firstResult: PromiseLike<ExecutionResult>,
			nextIndex: number,
			initialIssues: ExecutionIssue[] | undefined,
		): Promise<ExecutionResult> => {
			let result = await firstResult
			let issues = initialIssues

			while (true) {
				if ('issues' in result) {
					if (issues == null) {
						issues = [...result.issues]
					}
					else {
						for (const issue of result.issues)
							issues.push(issue)
					}
				}
				else {
					return result
				}

				if (nextIndex >= len)
					return failure(issues)

				result = await branchExecutors[nextIndex++]!(value)
			}
		}

		addSuccessStep((value) => {
			let issues: ExecutionIssue[] | undefined

			for (let i = 0; i < len; i++) {
				const branchResult = branchExecutors[i]!(value)

				if (isPromiseLike(branchResult))
					return continueAsync(value, branchResult, i + 1, issues)

				if ('value' in branchResult)
					return branchResult

				if (issues == null) {
					issues = [...branchResult.issues]
				}
				else {
					for (const issue of branchResult.issues)
						issues.push(issue)
				}
			}

			return failure(issues!)
		})
	},
})
