import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		string: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:string'
				condition: { schemaContext: null }
				issueCode: 'EXPECTED_STRING'
				patch: { output: string }
			},
			() => Valchecker.NextStep<this, 'string'>
		>
	}
}

export const string = {
	id: 'core:string',
	implement: {
		schemaMethods: {
			string: ({ addSuccessStep, success, failure }) => addSuccessStep(
				v => typeof v === 'string'
					? success(v)
					: failure('EXPECTED_STRING'),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:string'>
