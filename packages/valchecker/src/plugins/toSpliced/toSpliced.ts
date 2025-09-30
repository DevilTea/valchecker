import type { Valchecker } from '../../core/valchecker'
import type { OverloadParams } from '../../shared'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toSpliced: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toSpliced'
				condition: {
					schemaContext: {
						output: any[]
					}
				}
				issueCode: never
				patch: never
			},
			(
				...params: Valchecker.InferOutput<this> extends infer Arr extends any[]
					? OverloadParams<Arr['toSpliced']>
					: never
			) => Valchecker.NextStep<this, 'toSpliced'>
		>
	}
}

export const toSpliced = {
	id: 'core:toSpliced',
	implement: {
		schemaMethods: {
			toSpliced: ({ addSuccessStep, success }, ...params) => addSuccessStep(
				v => success(v.toSpliced(...params as Parameters<Array<any>['toSpliced']>)),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toSpliced'>
