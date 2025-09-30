import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		symbol: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:symbol'
				condition: { schemaContext: null }
				issueCode: 'EXPECTED_SYMBOL'
				patch: { output: symbol }
			},
			() => Valchecker.NextStep<this, 'symbol'>
		>
	}
}

export const symbol = {
	id: 'core:symbol',
	implement: {
		schemaMethods: {
			symbol: ({ addSuccessStep, success, failure }) => addSuccessStep(
				v => typeof v === 'symbol'
					? success(v)
					: failure('EXPECTED_SYMBOL'),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:symbol'>
