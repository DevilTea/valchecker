import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		toTrimmed: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:toTrimmed'
				condition: {
					schemaContext: {
						output: string
					}
				}
				issueCode: never
				patch: never
			},
			() => Valchecker.NextStep<this, 'toTrimmed'>
		>
	}
}

export const toTrimmed = {
	id: 'core:toTrimmed',
	implement: {
		schemaMethods: {
			toTrimmed: ({ addSuccessStep, success }) => addSuccessStep(
				v => success(v.trim()),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:toTrimmed'>
