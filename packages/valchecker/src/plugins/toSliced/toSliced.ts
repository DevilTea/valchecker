import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toSliced: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toSliced'
				condition: {
					schemaContext: {
						output: any[]
					}
				}
				issueCode: never
				patch: never
			},
			(...params: Valchecker.InferOutput<this> extends infer Arr extends any[]
				? Parameters<Arr['slice']>
				: never) => Valchecker.NextStep<
				this,
				'toSliced'
			>
		>
	}
}

export const toSliced = {
	id: 'core:toSliced',
	implement: {
		schemaMethods: {
			toSliced: ({ addSuccessStep, success }, ...params) => addSuccessStep(
				v => success(v.slice(...params)),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toSliced'>
