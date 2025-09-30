import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		bigint: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:bigint'
				condition: { schemaContext: null }
				issueCode: 'EXPECTED_BIGINT'
				patch: { output: bigint }
			},
			() => Valchecker.NextStep<this, 'bigint'>
		>
	}
}

export const bigint = {
	id: 'core:bigint',
	implement: {
		schemaMethods: {
			bigint: ({ addSuccessStep, success, failure }) => addSuccessStep(
				v => typeof v === 'bigint'
					? success(v)
					: failure('EXPECTED_BIGINT'),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:bigint'>
