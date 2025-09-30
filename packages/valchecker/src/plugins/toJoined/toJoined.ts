import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toJoined: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toJoined'
				condition: {
					schemaContext: {
						output: any[]
					}
				}
				issueCode: never
				patch: { output: string }
			},
			(...params: Valchecker.InferOutput<this> extends infer Arr extends any[]
				? Parameters<Arr['join']>
				: never
			) => Valchecker.NextStep<
				this,
				'toJoined'
			>
		>
	}
}

export const toJoined = {
	id: 'core:toJoined',
	implement: {
		schemaMethods: {
			toJoined: ({ addSuccessStep, success }, ...params) => addSuccessStep(
				v => success(v.join(...params)),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toJoined'>
