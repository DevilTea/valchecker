import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toIsIncluding: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toIsIncluding'
				condition: {
					schemaContext: {
						output: any[]
					}
				}
				issueCode: never
				patch: { output: boolean }
			},
			(...params: Valchecker.InferOutput<this> extends infer Arr extends any[]
				? Parameters<Arr['includes']>
				: never
			) => Valchecker.NextStep<
				this,
				'toIsIncluding'
			>
		>
	}
}

export const toIsIncluding = {
	id: 'core:toIsIncluding',
	implement: {
		schemaMethods: {
			toIsIncluding: ({ addSuccessStep, success }, ...params) => addSuccessStep(
				v => success(v.includes(...params)),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toIsIncluding'>
