import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef, TValchecker, Use, Valchecker } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import type { TemplateLiteralPartDescriptor } from './template-literal-part'
import { implStepPlugin } from '../../core'
import { expandDescriptors, matchesMember, renderTemplate, templateLiteralPartMarker } from './template-literal-part'

declare namespace Internal {
	export type InterpolatablePrimitive = string | number | bigint | boolean | null | undefined
	export type Part = InterpolatablePrimitive | Use<Valchecker>

	// Per-element validation so a compile error lands on the offending element.
	export type ValidateParts<Parts extends readonly unknown[]> = {
		[K in keyof Parts]: Parts[K] extends TValchecker
			? [InferOutput<Parts[K]>] extends [InterpolatablePrimitive] ? Parts[K] : never
			: Parts[K] extends InterpolatablePrimitive ? Parts[K] : never
	}

	type PartToType<P> = P extends TValchecker ? InferOutput<P> : P

	// `infer T extends InterpolatablePrimitive` captures the WHOLE union
	// non-distributively; `${T}` interpolation then distributes into the
	// cross-product, matching tsc's `getTemplateLiteralType`.
	export type Build<Parts extends readonly unknown[]> = Parts extends readonly [infer H, ...infer R]
		? PartToType<H> extends infer T extends InterpolatablePrimitive ? `${T}${Build<R>}` : never
		: ''

	export type Issue = ExecutionIssue<'templateLiteral:expected_template_literal', { value: unknown, template: string }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'templateLiteral'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a string matching an assembled TypeScript
	 * template-literal type, and infers that exact template-literal output type.
	 *
	 * Each part is either an interpolatable literal (`string | number | bigint |
	 * boolean | null | undefined`) or a bare initial schema whose output is
	 * interpolatable: `v.string()`, `v.number()`, `v.bigint()`, `v.boolean()`,
	 * `v.literal(...)`, `v.null()`, `v.undefined()`, `v.union([...])`, or a nested
	 * `v.templateLiteral([...])`. Union parts expand into a cross-product union.
	 *
	 * Both matching and inference follow the TypeScript checker exactly, including
	 * the leftmost, one-character, no-backtracking split rule for adjacent
	 * placeholders. For example `` `${string}x${number}` `` rejects `'axbx1'`
	 * (the leftmost `x` leaves `'bx1'` for `${number}`), and `` `${string}${number}` ``
	 * rejects `'abc1'` (the `${string}` slot captures a single character).
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, number, templateLiteral, union } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [templateLiteral, number, union] })
	 * const schema = v.templateLiteral([v.number(), v.union(['px', 'em', 'rem'])])
	 * const result = schema.execute('12px')
	 * // { value: '12px' }, output type `${number}px` | `${number}em` | `${number}rem`
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'templateLiteral:expected_template_literal'`: The value is not a string
	 *   or does not match the assembled template. Payload: `{ value, template }`.
	 */
	templateLiteral: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? <const Parts extends readonly Internal.Part[]>(
						parts: Parts & Internal.ValidateParts<Parts>,
						options?: StepOptions<Meta['SelfIssue']>,
					) => Next<{ output: Internal.Build<Parts>, issue: Meta['SelfIssue'] }, this['CurrentValchecker']>
				: never
			: never
	>
}

function isValcheckerSchema(value: unknown): value is Use<Valchecker> {
	return (
		typeof value === 'function'
		|| (typeof value === 'object' && value !== null)
	) && typeof Reflect.get(value, '~execute') === 'function'
}

function normalizePart(part: unknown, index: number): TemplateLiteralPartDescriptor {
	if (part === null)
		return { kind: 'literal', value: null }
	if (part === undefined)
		return { kind: 'literal', value: undefined }
	const type = typeof part
	if (type === 'string' || type === 'boolean' || type === 'bigint')
		return { kind: 'literal', value: part as string | boolean | bigint }
	if (type === 'number') {
		if (!Number.isFinite(part))
			throw new TypeError(`templateLiteral() part at index ${index} is a non-finite number, which has no TypeScript literal type.`)
		return { kind: 'literal', value: part as number }
	}
	if (type === 'symbol')
		throw new TypeError(`templateLiteral() part at index ${index} is a symbol, which cannot be interpolated into a template literal.`)
	if (isValcheckerSchema(part)) {
		// limit: metadata is construction-scoped and dropped by chaining, so a
		// refined schema (e.g. `v.string().toTrimmed()`) carries no descriptor and
		// is rejected here. Silently ignoring the promised refinement would be
		// worse; per-segment sub-schema execution is the (out-of-scope) upgrade.
		const descriptor = part['~core']?.metadata?.[templateLiteralPartMarker] as TemplateLiteralPartDescriptor | undefined
		if (descriptor === undefined)
			throw new TypeError(`templateLiteral() schema part at index ${index} is not a supported template-literal part (only bare number/bigint/string/boolean/null/undefined/literal/union/templateLiteral schemas are allowed).`)
		return descriptor
	}
	throw new TypeError(`templateLiteral() part at index ${index} must be an interpolatable literal or a supported schema.`)
}

/* @__NO_SIDE_EFFECTS__ */
export const templateLiteral = implStepPlugin<PluginDef>({
	templateLiteral: ({
		utils: { addSuccessStep, success, createIssue, failure, setMetadata },
		params: [parts, options],
	}) => {
		if (!Array.isArray(parts))
			throw new TypeError('templateLiteral() requires an array of parts.')

		const descriptors = (parts as readonly unknown[]).map(normalizePart)
		setMetadata(templateLiteralPartMarker, { kind: 'template', parts: descriptors })

		const members = expandDescriptors(descriptors)
		const template = renderTemplate(descriptors)

		addSuccessStep(value => typeof value === 'string' && members.some(member => matchesMember(value, member))
			// The matched input IS the assembled template-literal type at runtime;
			// the impl-side output type resolves to the generic constraint, so cast.
			? success(value as never)
			: failure(createIssue({
					code: 'templateLiteral:expected_template_literal',
					payload: { value, template },
					customMessage: options?.message,
					defaultMessage: `Expected a string matching ${template}.`,
				})))
	},
}, 'sync')
