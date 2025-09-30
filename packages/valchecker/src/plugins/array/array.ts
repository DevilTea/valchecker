import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		array: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:array'
				condition: { schemaContext: null }
				issueCode: 'EXPECTED_ARRAY'
				patch: never
			},
			<ItemSchema extends Valchecker.Use<Valchecker>>(itemSchema: ItemSchema) => Valchecker.NextStep<
				this,
				'array',
				{
					async: Valchecker.InferAsync<ItemSchema>
					output: Array<Awaited<Valchecker.InferOutput<ItemSchema>>>
				}
			>
		>
	}
}

export const array = {
	id: 'core:array',
	implement: {
		schemaMethods: {
			array: ({ addSuccessStep, isSuccess, prependIssuePath, success, failure }, itemSchema) => addSuccessStep(
				(v) => {
					if (Array.isArray(v) === false)
						return failure('EXPECTED_ARRAY')

					const output = Array.from(v)
					const issues: Valchecker.ExecutionIssue[] = []

					function processResult(result: Valchecker.ExecutionResult<any>, index: number) {
						if (isSuccess(result)) {
							output[index] = result.value
							return
						}
						issues.push(...result.issues.map(issue => prependIssuePath(issue, [index])))
					}

					let promise: Promise<void> | null = null
					for (let i = 0; i < output.length; i++) {
						const item = output[i]
						const result = itemSchema['~valchecker'].execute(item)

						if (promise == null) {
							if (result instanceof Promise)
								promise = result.then(result => processResult(result, i))
							else
								processResult(result, i)
						}
						else {
							promise = promise.then(() => result).then(result => processResult(result, i))
						}
					}

					return promise == null
						? (issues.length === 0 ? success(output) : failure(issues))
						: promise.then(() => issues.length === 0 ? success(output) : failure(issues))
				},
			),
		},
	},
} satisfies Valchecker.Plugin<'core:array'>
