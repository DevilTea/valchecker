import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toFiltered: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toFiltered'
				condition: {
					schemaContext: {
						output: any[]
					}
				}
				issueCode: never
				patch: never
			},
			<S>(...params: Valchecker.InferOutput<this> extends infer Arr extends any[]
				? [predicate: (value: Arr[number], index: number, array: Arr) => value is S]
				: never
			) => Valchecker.NextStep<
				this,
				'toFiltered',
				{ output: S[] }
			>
		>
	}
}

export const toFiltered = {
	id: 'core:toFiltered',
	implement: {
		schemaMethods: {
			toFiltered: ({ addSuccessStep, success }, ...params) => addSuccessStep(
				v => success(v.filter(...params)),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toFiltered'>
