import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

function isEmojiValue(value: string): boolean {
	if (value === '')
		return false
	return value.replace(/\p{RGI_Emoji}/gv, '') === ''
}

type Meta = DefineStepMethodMeta<{
	Name: 'isEmoji'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isEmoji:expected_emoji', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string consists solely of RGI emoji. It removes every
	 * `\p{RGI_Emoji}` match (using the `v` flag, so ZWJ sequences such as
	 * family emoji and skin-tone modifier sequences count as one emoji each)
	 * and passes only when nothing else remains. The empty string is
	 * rejected.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isEmoji, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isEmoji] })
	 * const result = v.string().isEmoji().execute('😀')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isEmoji:expected_emoji'`: The string is not an emoji.
	 */
	isEmoji: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (options?: StepOptions<Meta['SelfIssue']>) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isEmoji = implStepPlugin<PluginDef>({
	isEmoji: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => isEmojiValue(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isEmoji:expected_emoji',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected an emoji.',
					}),
				))
	},
}, 'sync')
