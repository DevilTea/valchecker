import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toLowerCase: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toLowerCase'
				condition: {
					schemaContext: {
						output: string
					}
				}
				issueCode: never
				patch: never
			},
			() => Valchecker.NextStep<this, 'toLowerCase'>
		>
	}
}

export const toLowerCase = {
	id: 'core:toLowerCase',
	implement: {
		schemaMethods: {
			toLowerCase: ({ addSuccessStep, success }) => addSuccessStep(
				v => success(v.toLowerCase()),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toLowerCase'>
