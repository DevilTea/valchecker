import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		null_: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:null_'
				condition: { schemaContext: null }
				issueCode: 'EXPECTED_NULL'
				patch: { output: null }
			},
			() => Valchecker.NextStep<this, 'null_'>
		>
	}
}

export const null_ = {
	id: 'core:null_',
	implement: {
		schemaMethods: {
			null_: ({ addSuccessStep, success, failure }) => addSuccessStep(
				v => v === null
					? success(v)
					: failure('EXPECTED_NULL'),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:null_'>
