import type { Valchecker } from '../../core/valchecker'
import type { IsPromise, MaybePromise } from '../../shared'

declare module '../../core/valchecker' {
	export interface Valchecker {
		fallback: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:fallback'
				condition: { schemaContext: Valchecker.TSchemaContext }
				issueCode: 'FALLBACK_FAILED'
				patch: never
			},
			<LastOutput extends Valchecker.InferOutput<this>, FallbackResult extends MaybePromise<LastOutput>>(fn: (issues: Valchecker.ExecutionIssue[]) => FallbackResult) => Valchecker.NextStep<
				this,
				'fallback',
				{
					async: IsPromise<FallbackResult>
				}
			>
		>
	}
}

export const fallback = {
	id: 'core:fallback',
	implement: {
		schemaMethods: {
			fallback: ({ addFailureStep, success, failure, issue }, fn) => addFailureStep(
				(issues) => {
					try {
						const result = fn(issues)
						return result instanceof Promise
							? result.then(success).catch(error => failure(issue('FALLBACK_FAILED', { error })))
							: success(result)
					}
					catch (error) {
						return failure(issue('FALLBACK_FAILED', { error }))
					}
				},
			),
		},
	},
} satisfies Valchecker.Plugin<'core:fallback'>
