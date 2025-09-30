import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toReversed: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toReversed'
				condition: {
					schemaContext: {
						output: any[]
					}
				}
				issueCode: never
				patch: never
			},
			(...params: Valchecker.InferOutput<this> extends infer Arr extends any[]
				? Parameters<Arr['toReversed']>
				: never
			) => Valchecker.NextStep<
				this,
				'toReversed'
			>
		>
	}
}

export const toReversed = {
	id: 'core:toReversed',
	implement: {
		schemaMethods: {
			toReversed: ({ addSuccessStep, success }, ...params) => addSuccessStep(
				v => success(v.toReversed(...params)),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toReversed'>
