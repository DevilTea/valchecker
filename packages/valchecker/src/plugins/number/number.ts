import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		number: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:number'
				condition: { schemaContext: null }
				issueCode: 'EXPECTED_NUMBER'
				patch: { output: number }
			},
			() => Valchecker.NextStep<this, 'number'>
		>
	}
}

export const number = {
	id: 'core:number',
	implement: {
		schemaMethods: {
			number: ({ addSuccessStep, success, failure }) => addSuccessStep(
				v => typeof v === 'number'
					? success(v)
					: failure('EXPECTED_NUMBER'),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:number'>
