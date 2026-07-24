import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

const pattern = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i

type Meta = DefineStepMethodMeta<{
	Name: 'isUuid'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isUuid:expected_uuid', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is a UUID. Accepts the RFC 9562 / RFC 4122
	 * versions 1 through 8 with a canonical variant nibble, plus the special
	 * nil and max UUIDs. Matching is case-insensitive.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isUuid, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isUuid] })
	 * const result = v.string().isUuid().execute('123e4567-e89b-12d3-a456-426614174000')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isUuid:expected_uuid'`: The string is not a valid UUID.
	 */
	isUuid: DefineStepMethod<
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
export const isUuid = implStepPlugin<PluginDef>({
	isUuid: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => pattern.test(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isUuid:expected_uuid',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid UUID.',
					}),
				))
	},
}, 'sync')
