import type { Valchecker } from '../../core/valchecker'
import type { IsPromise } from '../../shared'

declare module '../../core/valchecker' {
	export interface Valchecker {
		transform: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:transform'
				condition: { schemaContext: Valchecker.TSchemaContext }
				issueCode: 'CUSTOM_TRANSFORM_FAILED'
				patch: never
			},
			<LastOutput extends Valchecker.InferOutput<this>, TransformResult>(
				fn: (value: LastOutput) => TransformResult,
			) => Valchecker.NextStep<
				this,
				'transform',
				{
					async: IsPromise<TransformResult>
					output: TransformResult extends Promise<infer T> ? T : TransformResult
				}
			>
		>
	}
}

export const transform = {
	id: 'core:transform',
	implement: {
		schemaMethods: {
			transform: ({ addSuccessStep, success, failure, issue }, fn) => addSuccessStep(
				(v) => {
					try {
						const result = fn(v)
						return result instanceof Promise
							? result.then(success).catch(error => failure(issue('CUSTOM_TRANSFORM_FAILED', { error })))
							: success(result)
					}
					catch (error) {
						return failure(issue('CUSTOM_TRANSFORM_FAILED', { error }))
					}
				},
			),
		},
	},
} satisfies Valchecker.Plugin<'core:transform'>
