import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toIsSome: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toIsSome'
				condition: {
					schemaContext: {
						output: any[]
					}
				}
				issueCode: never
				patch: { output: boolean }
			},
			(...params: Valchecker.InferOutput<this> extends infer Arr extends any[]
				? Parameters<Arr['some']>
				: never
			) => Valchecker.NextStep<
				this,
				'toIsSome'
			>
		>
	}
}

export const toIsSome = {
	id: 'core:toIsSome',
	implement: {
		schemaMethods: {
			toIsSome: ({ addSuccessStep, success }, ...params) => addSuccessStep(
				v => success(v.some(...params)),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toIsSome'>
