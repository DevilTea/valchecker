import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		boolean: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:boolean'
				condition: { schemaContext: null }
				issueCode: 'EXPECTED_BOOLEAN'
				patch: { output: boolean }
			},
			() => Valchecker.NextStep<this, 'boolean'>
		>
	}
}

export const boolean = {
	id: 'core:boolean',
	implement: {
		schemaMethods: {
			boolean: ({ addSuccessStep, success, failure }) => addSuccessStep(
				v => typeof v === 'boolean'
					? success(v)
					: failure('EXPECTED_BOOLEAN'),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:boolean'>
