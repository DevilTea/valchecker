import type { IsEqual } from 'type-fest'
import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionResult, ExecutionSuccessResult, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import { hasInternalIssue, implStepPlugin } from '../../core'
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
	 * Checks that the value passes at least one branch and returns the first
	 * successful branch output. Failed branch issues receive a non-data
	 * `{ type: 'union', branchIndex }` context entry. Internal failures stop
	 * branch evaluation immediately.
	 */
	union: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? <B extends [Use<Valchecker>, ...Use<Valchecker>[]]>(
				branches: B,
			) => Next<{
				operationMode: Internal.OpMode<B>
				output: Internal.Output<B>
				issue: Internal.Issue<B>
			}, this['CurrentValchecker']>
			: never
	>
}

type BranchOutcome
	= | ExecutionSuccessResult<unknown>
		| { issues: [AnyExecutionIssue, ...AnyExecutionIssue[]] }
		| null

/* @__NO_SIDE_EFFECTS__ */
export const union = implStepPlugin<PluginDef>({
	union: ({
		utils: { addSuccessStep, appendIssueContext, failure, isFailure },
		params: [branches],
	}) => {
		const branchExecutors = branches.map(branch => branch['~execute'])
		const len = branchExecutors.length

		addSuccessStep((value) => {
			const issues: AnyExecutionIssue[] = []

			const processBranchResult = (result: ExecutionResult, branchIndex: number): BranchOutcome => {
				if (!isFailure(result))
					return result

				for (const issue of result.issues) {
					issues.push(appendIssueContext(issue, {
						type: 'union',
						branchIndex,
					}))
				}
				return hasInternalIssue(result.issues)
					? failure(issues)
					: null
			}

			const continueAsync = async (startIndex: number, firstResult: PromiseLike<ExecutionResult>) => {
				for (let i = startIndex; i < len; i++) {
					const result = i === startIndex
						? await firstResult
						: await branchExecutors[i]!(value)
					const outcome = processBranchResult(result, i)
					if (outcome != null)
						return outcome
				}
				return failure(issues)
			}

			for (let i = 0; i < len; i++) {
				const branchResult = branchExecutors[i]!(value)
				if (isPromiseLike(branchResult))
					return continueAsync(i, branchResult)
				const outcome = processBranchResult(branchResult, i)
				if (outcome != null)
					return outcome
			}

			return failure(issues)
		})
	},
})
