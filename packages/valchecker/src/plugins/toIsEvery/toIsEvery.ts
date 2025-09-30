import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toIsEvery: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toIsEvery'
				condition: {
					schemaContext: {
						output: any[]
					}
				}
				issueCode: never
				patch: { output: boolean }
			},
			(...params: Valchecker.InferOutput<this> extends infer Arr extends any[]
				? Parameters<Arr['every']>
				: never
			) => Valchecker.NextStep<
				this,
				'toIsEvery'
			>
		>
	}
}

export const toIsEvery = {
	id: 'core:toIsEvery',
	implement: {
		schemaMethods: {
			toIsEvery: ({ addSuccessStep, success }, ...params) => addSuccessStep(
				v => success(v.every(...params)),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toIsEvery'>
