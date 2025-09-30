import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toUpperCase: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toUpperCase'
				condition: {
					schemaContext: {
						output: string
					}
				}
				issueCode: never
				patch: never
			},
			() => Valchecker.NextStep<this, 'toUpperCase'>
		>
	}
}

export const toUpperCase = {
	id: 'core:toUpperCase',
	implement: {
		schemaMethods: {
			toUpperCase: ({ addSuccessStep, success }) => addSuccessStep(
				v => success(v.toUpperCase()),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toUpperCase'>
