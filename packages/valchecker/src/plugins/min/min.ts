import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		min: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:min'
				condition: {
					schemaContext: {
						output: number | { length: number }
					}
				}
				issueCode: 'EXPECTED_MIN'
				patch: never
			},
			(minValue: number) => Valchecker.NextStep<this, 'min'>
		>
	}
}

export const min = {
	id: 'core:min',
	implement: {
		schemaMethods: {
			min: ({ addSuccessStep, success, failure }, minValue) => addSuccessStep(
				v => (typeof v === 'number' ? v : v.length) >= minValue
					? success(v)
					: failure('EXPECTED_MIN'),

			),
		},
	},
} satisfies Valchecker.Plugin<'core:min'>
