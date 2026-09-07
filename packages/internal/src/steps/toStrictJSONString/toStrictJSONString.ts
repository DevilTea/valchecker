import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { markIssueSnapshotPayload } from '../../core/core'
import { snapshotMessageOptions } from '../../core/message'

declare namespace Internal {
	export type UnsupportedType = 'bigint' | 'function' | 'symbol'
	export type UnserializablePayload<Input = unknown>
		= | { reason: 'unsupported_type', value: Input, at: PropertyKey[], valueType: UnsupportedType }
			| { reason: 'circular_reference', value: Input, at: PropertyKey[] }
			| { reason: 'undefined_result', value: Input, at: PropertyKey[] }
	export type UnserializableIssue<Input = unknown> = ExecutionIssue<
		'toStrictJSONString:unserializable',
		UnserializablePayload<Input>
	>
	export type SerializationFailedIssue<Input = unknown> = ExecutionIssue<
		'toStrictJSONString:serialization_failed',
		{ value: Input, at: PropertyKey[], error: unknown },
		'operation'
	>
	export type Issue<Input = unknown> = UnserializableIssue<Input> | SerializationFailedIssue<Input>
}

type Meta = DefineStepMethodMeta<{
	Name: 'toStrictJSONString'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts the current value to JSON text after a single-read preflight.
	 * Unsupported data emits `toStrictJSONString:unserializable`; getter, Proxy, or
	 * `toJSON` failures emit the operation issue `toStrictJSONString:serialization_failed`.
	 * Lossy slots are treated uniformly: an explicit `undefined`, an unsupported
	 * value, or an array hole all fail rather than being silently coerced.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, toStrictJSONString, unknown } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [unknown, toStrictJSONString] })
	 * const schema = v.unknown().toStrictJSONString()
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toStrictJSONString:unserializable'`: The value (or a nested slot) has no JSON representation.
	 * - `'toStrictJSONString:serialization_failed'`: A getter, Proxy trap, or `toJSON` threw during serialization.
	 */
	toStrictJSONString: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? (options?: StepOptions<Internal.Issue<InferOutput<This>>>) => Next<
					{ output: string, issue: Internal.Issue<InferOutput<This>> },
					This
				>
			: never
	>
}

type Prepared
	= | { ok: true, value: unknown }
		| { ok: false, type: 'validation', reason: 'unsupported_type', at: PropertyKey[], valueType: Internal.UnsupportedType }
		| { ok: false, type: 'validation', reason: 'circular_reference' | 'undefined_result', at: PropertyKey[] }
		| { ok: false, type: 'operation', at: PropertyKey[], error: unknown }

function setPreparedValue(target: Record<PropertyKey, unknown>, key: PropertyKey, value: unknown): void {
	Object.defineProperty(target, key, {
		configurable: true,
		enumerable: true,
		value,
		writable: true,
	})
}

function prepareJSON(value: unknown): Prepared {
	const ancestors = new WeakSet<object>()

	const visit = (
		current: unknown,
		at: PropertyKey[],
		key: string,
		applyToJSON: boolean,
	): Prepared => {
		if (current === undefined)
			return { ok: false, type: 'validation', reason: 'undefined_result', at }

		const valueType = typeof current
		if (valueType === 'bigint' || valueType === 'function' || valueType === 'symbol') {
			return { ok: false, type: 'validation', reason: 'unsupported_type', at, valueType }
		}
		if (current === null || valueType === 'string' || valueType === 'boolean' || valueType === 'number')
			return { ok: true, value: current }

		const objectValue = current as Record<PropertyKey, unknown>
		if (applyToJSON) {
			let toJSON: unknown
			try {
				toJSON = objectValue.toJSON
			}
			catch (error) {
				return { ok: false, type: 'operation', at, error }
			}
			if (typeof toJSON === 'function') {
				let resolved: unknown
				try {
					resolved = toJSON.call(current, key)
				}
				catch (error) {
					return { ok: false, type: 'operation', at, error }
				}
				return visit(resolved, at, key, false)
			}
		}

		try {
			// eslint-disable-next-line unicorn/no-instanceof-builtins -- strict preflight recognizes same-realm boxed primitives before traversing ordinary objects
			if (current instanceof Number)
				return visit(Number.prototype.valueOf.call(current), at, key, false)
			// eslint-disable-next-line unicorn/no-instanceof-builtins -- strict preflight recognizes same-realm boxed primitives before traversing ordinary objects
			if (current instanceof String)
				return visit(String.prototype.valueOf.call(current), at, key, false)
			// eslint-disable-next-line unicorn/no-instanceof-builtins -- strict preflight recognizes same-realm boxed primitives before traversing ordinary objects
			if (current instanceof Boolean)
				return visit(Boolean.prototype.valueOf.call(current), at, key, false)
			// eslint-disable-next-line unicorn/no-instanceof-builtins -- strict preflight recognizes same-realm boxed primitives before traversing ordinary objects
			if (current instanceof BigInt)
				return visit(BigInt.prototype.valueOf.call(current), at, key, false)
		}
		catch (error) {
			return { ok: false, type: 'operation', at, error }
		}

		const identity = current as object
		if (ancestors.has(identity))
			return { ok: false, type: 'validation', reason: 'circular_reference', at }
		ancestors.add(identity)

		if (Array.isArray(current)) {
			let length: number
			try {
				length = current.length
			}
			catch (error) {
				ancestors.delete(identity)
				return { ok: false, type: 'operation', at, error }
			}
			const output = Array.from({ length })
			for (let index = 0; index < length; index++) {
				const childAt = [...at, index]
				// Array holes carry no serializable value; report them with the same
				// strictness as an explicit `undefined` element instead of silently
				// coercing to `null` the way native JSON.stringify would.
				let hasOwn: boolean
				try {
					hasOwn = Object.hasOwn(current, index)
				}
				catch (error) {
					ancestors.delete(identity)
					return { ok: false, type: 'operation', at: childAt, error }
				}
				if (!hasOwn) {
					ancestors.delete(identity)
					return { ok: false, type: 'validation', reason: 'undefined_result', at: childAt }
				}
				let child: unknown
				try {
					child = current[index]
				}
				catch (error) {
					ancestors.delete(identity)
					return { ok: false, type: 'operation', at: childAt, error }
				}
				const prepared = visit(child, childAt, String(index), true)
				if (!prepared.ok) {
					ancestors.delete(identity)
					return prepared
				}
				output[index] = prepared.value
			}
			ancestors.delete(identity)
			return { ok: true, value: output }
		}

		let keys: string[]
		try {
			keys = Object.keys(current)
		}
		catch (error) {
			ancestors.delete(identity)
			return { ok: false, type: 'operation', at, error }
		}
		const output: Record<PropertyKey, unknown> = Object.create(null)
		for (let index = 0; index < keys.length; index++) {
			const property = keys[index]!
			const childAt = [...at, property]
			let child: unknown
			try {
				child = objectValue[property]
			}
			catch (error) {
				ancestors.delete(identity)
				return { ok: false, type: 'operation', at: childAt, error }
			}
			const prepared = visit(child, childAt, property, true)
			if (!prepared.ok) {
				ancestors.delete(identity)
				return prepared
			}
			setPreparedValue(output, property, prepared.value)
		}
		ancestors.delete(identity)
		return { ok: true, value: output }
	}

	return visit(value, [], '', true)
}

/* @__NO_SIDE_EFFECTS__ */
export const toStrictJSONString = implStepPlugin<PluginDef>({
	toStrictJSONString: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const messageOptions = snapshotMessageOptions(options)
		addSuccessStep((value) => {
			const prepared = prepareJSON(value)
			if (!prepared.ok) {
				if (prepared.type === 'operation') {
					return failure(createIssue({
						code: 'toStrictJSONString:serialization_failed',
						category: 'operation',
						payload: markIssueSnapshotPayload(
							{ value, at: prepared.at, error: prepared.error },
							{ at: 'container' },
						),
						customMessage: messageOptions?.message,
						defaultMessage: 'JSON serialization failed.',
					}))
				}
				const payload = prepared.reason === 'unsupported_type'
					? markIssueSnapshotPayload(
							{ reason: prepared.reason, value, at: prepared.at, valueType: prepared.valueType } as const,
							{ at: 'container' },
						)
					: markIssueSnapshotPayload(
							{ reason: prepared.reason, value, at: prepared.at } as const,
							{ at: 'container' },
						)
				return failure(createIssue({
					code: 'toStrictJSONString:unserializable',
					payload,
					customMessage: messageOptions?.message,
					defaultMessage: 'Value cannot be serialized to JSON.',
				}))
			}

			try {
				const json = JSON.stringify(prepared.value)
				if (typeof json === 'string')
					return success(json)
				return failure(createIssue({
					code: 'toStrictJSONString:unserializable',
					payload: markIssueSnapshotPayload(
						{ reason: 'undefined_result', value, at: [] },
						{ at: 'container' },
					),
					customMessage: messageOptions?.message,
					defaultMessage: 'Value cannot be serialized to JSON.',
				}))
			}
			catch (error) {
				return failure(createIssue({
					code: 'toStrictJSONString:serialization_failed',
					category: 'operation',
					payload: markIssueSnapshotPayload(
						{ value, at: [], error },
						{ at: 'container' },
					),
					customMessage: messageOptions?.message,
					defaultMessage: 'JSON serialization failed.',
				}))
			}
		})
	},
}, 'sync')
