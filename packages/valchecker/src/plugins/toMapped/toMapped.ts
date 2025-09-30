import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toMapped: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toMapped'
				condition: {
					schemaContext: {
						output: any[]
					}
				}
				issueCode: never
				patch: never
			},
			<U>(...params: Valchecker.InferOutput<this> extends infer Arr extends any[]
				? [callbackfn: (value: Arr[number], index: number, array: Arr) => U]
				: never
			) => Valchecker.NextStep<
				this,
				'toMapped',
				{ output: U[] }
			>
		>
	}
}

export const toMapped = {
	id: 'core:toMapped',
	implement: {
		schemaMethods: {
			toMapped: ({ addSuccessStep, success }, ...params) => addSuccessStep(
				v => success(v.map(...params)),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toMapped'>
