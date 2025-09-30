import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toString: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toString'
				condition: {
					schemaContext: {
						output: { toString: (...params: any[]) => string }
					}
				}
				issueCode: never
				patch: { output: string }
			},
			(
				...params: Valchecker.InferOutput<this> extends { toString: (...params: any[]) => string }
					? Parameters<Valchecker.InferOutput<this>['toString']>
					: []
			) => Valchecker.NextStep<this, 'toString'>
		>
	}
}

export const toString = {
	id: 'core:toString',
	implement: {
		schemaMethods: {
			toString: ({ addSuccessStep, success }, ...params) => addSuccessStep(
				v => success(v.toString(...params)),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toString'>
