import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Form = 'NFC' | 'NFD' | 'NFKC' | 'NFKD'
	export interface Options { readonly form?: Form | undefined }
}

type Meta = DefineStepMethodMeta<{
	Name: 'toNormalized'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Normalizes a string with `String.prototype.normalize`. `form` may be `'NFC'`,
	 * `'NFD'`, `'NFKC'`, or `'NFKD'` and defaults to `'NFC'`. An unsupported form
	 * throws a `TypeError` while constructing the schema.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toNormalized } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toNormalized] })
	 * const schema = v.string().toNormalized({ form: 'NFC' })
	 * const result = schema.execute('é')
	 * // result.value: 'é'
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toNormalized: DefineStepMethod<Meta, this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
		? (options?: Internal.Options) => Next<{ output: string }, this['CurrentValchecker']>
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const toNormalized = implStepPlugin<PluginDef>({
	toNormalized: ({ utils: { addSuccessStep, success }, params: [options] }) => {
		const form = options?.form ?? 'NFC'
		if (form !== 'NFC' && form !== 'NFD' && form !== 'NFKC' && form !== 'NFKD')
			throw new TypeError('toNormalized() form must be NFC, NFD, NFKC, or NFKD.')
		addSuccessStep(value => success(value.normalize(form)))
	},
}, 'sync')
