import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		undefined_: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:undefined_'
				condition: { schemaContext: null }
				issueCode: 'EXPECTED_UNDEFINED'
				patch: { output: undefined }
			},
			() => Valchecker.NextStep<this, 'undefined_'>
		>
	}
}

export const undefined_ = {
	id: 'core:undefined_',
	implement: {
		schemaMethods: {
			undefined_: ({ addSuccessStep, success, failure }) => addSuccessStep(
				v => typeof v === 'undefined'
					? success(v)
					: failure('EXPECTED_UNDEFINED'),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:undefined_'>
