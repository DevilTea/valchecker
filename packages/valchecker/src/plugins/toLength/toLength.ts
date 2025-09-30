import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toLength: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toLength'
				condition: {
					schemaContext: {
						output: { length: number }
					}
				}
				issueCode: never
				patch: { output: number }
			},
			() => Valchecker.NextStep<this, 'toLength'>
		>
	}
}

export const toLength = {
	id: 'core:toLength',
	implement: {
		schemaMethods: {
			toLength: ({ addSuccessStep, success }) => addSuccessStep(
				v => success(v.length),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toLength'>
