import type { Valchecker } from '../../core/valchecker'

declare module '../../core/valchecker' {
	export interface Valchecker {
		max: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:max'
				condition: {
					schemaContext: {
						output: number | { length: number }
					}
				}
				issueCode: 'EXPECTED_MAX'
				patch: never
			},
			(maxValue: number) => Valchecker.NextStep<this, 'max'>
		>
	}
}

export const max = {
	id: 'core:max',
	implement: {
		schemaMethods: {
			max: ({ addSuccessStep, success, failure }, maxValue) => addSuccessStep(
				v => (typeof v === 'number' ? v : v.length) <= maxValue
					? success(v)
					: failure('EXPECTED_MAX'),
			),
		},
	},
} satisfies Valchecker.Plugin<'core:max'>
