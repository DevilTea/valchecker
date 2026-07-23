import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue = ExecutionIssue<'isUrl:expected_url', { value: string, protocols: readonly string[] }>
	export interface Options extends StepOptions<Issue> {
		readonly protocols?: readonly string[] | undefined
	}
}

function isUrlValue(value: string, protocols: readonly string[]): boolean {
	let url: URL
	try {
		url = new URL(value)
	}
	catch {
		return false
	}
	return protocols.includes(url.protocol.slice(0, -1))
}

type Meta = DefineStepMethodMeta<{
	Name: 'isUrl'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string parses as a URL via the WHATWG `URL` constructor
	 * and that its scheme is in an allow-list. The default allow-list is
	 * `['http', 'https']`; override it with the `protocols` option (scheme
	 * names without the trailing colon). The allowed protocols are included in
	 * the failure payload.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isUrl, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isUrl] })
	 * const result = v.string().isUrl().execute('https://example.com/path')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isUrl:expected_url'`: The string is not a valid URL.
	 */
	isUrl: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (options?: Internal.Options) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isUrl = implStepPlugin<PluginDef>({
	isUrl: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const protocols = Object.freeze([...(options?.protocols ?? ['http', 'https'])])
		addSuccessStep(value => isUrlValue(value, protocols)
			? success(value)
			: failure(
					createIssue({
						code: 'isUrl:expected_url',
						payload: { value, protocols },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid URL.',
					}),
				))
	},
}, 'sync')
