import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toSorted: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toSorted'
				condition: {
					schemaContext: {
						output: any[]
					}
				}
				issueCode: never
				patch: never
			},
			(...params: Valchecker.InferOutput<this> extends infer Arr extends any[]
				? Parameters<Arr['toSorted']>
				: never
			) => Valchecker.NextStep<
				this,
				'toSorted'
			>
		>
	}
}

export const toSorted = {
	id: 'core:toSorted',
	implement: {
		schemaMethods: {
			toSorted: ({ addSuccessStep, success }, ...params) => addSuccessStep(
				v => success(v.toSorted(...params)),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toSorted'>
