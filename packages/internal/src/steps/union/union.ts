import type { IsEqual } from 'type-fest'
import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
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

/* @__NO_SIDE_EFFECTS__ */
export const union = implStepPlugin<PluginDef>({
	union: ({
		utils: { addSuccessStep, appendIssueContext, failure, isFailure },
		params: [branches],
	}) => {
		const branchExecutors = branches.map(branch => branch['~execute'])
		const len = branchExecutors.length

		addSuccessStep((value) => {
			let issues: AnyExecutionIssue[] | undefined

			for (let i = 0; i < len; i++) {
				const branchResult = branchExecutors[i]!(value)
				if (isPromiseLike(branchResult)) {
					return (async () => {
						for (let j = i; j < len; j++) {
							const result = j === i
								? await branchResult
								: await branchExecutors[j]!(value)
							if (!isFailure(result))
								return result

							const collected = issues ??= []
							const branchStart = collected.length
							let hasInternal = false
							for (const issue of result.issues) {
								if (issue.category === 'internal')
									hasInternal = true
								collected.push(appendIssueContext(issue, {
									type: 'union',
									branchIndex: j,
								}))
							}
							if (hasInternal)
								return failure(collected.slice(branchStart))
						}
						return failure(issues!)
					})()
				}

				if (!isFailure(branchResult))
					return branchResult

				const collected = issues ??= []
				const branchStart = collected.length
				let hasInternal = false
				for (const issue of branchResult.issues) {
					if (issue.category === 'internal')
						hasInternal = true
					collected.push(appendIssueContext(issue, {
						type: 'union',
						branchIndex: i,
					}))
				}
				if (hasInternal)
					return failure(collected.slice(branchStart))
			}

			return failure(issues!)
		})
	},
})
