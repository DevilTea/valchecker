import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type UnserializablePayload<Input = unknown>
		= | { reason: 'unsupported_type', value: Input, at: PropertyKey[], valueType: string }
			| { reason: 'circular_reference', value: Input, at: PropertyKey[] }
			| { reason: 'undefined_result', value: Input, at: PropertyKey[] }
	export type UnserializableIssue<Input = unknown> = ExecutionIssue<
		'toJSONString:unserializable',
		UnserializablePayload<Input>
	>
	export type SerializationFailedIssue<Input = unknown> = ExecutionIssue<
		'toJSONString:serialization_failed',
		{ value: Input, at: PropertyKey[], error: unknown },
		'operation'
	>
	export type Issue<Input = unknown> = UnserializableIssue<Input> | SerializationFailedIssue<Input>
}

type Meta = DefineStepMethodMeta<{
	Name: 'toJSONString'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	toJSONString: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (message?: MessageHandler<Internal.Issue>) => Next<
				{ output: string, issue: Internal.Issue },
				this['CurrentValchecker']
			>
			: never
	>
}

type Prepared
	= | { ok: true, value: unknown }
		| { ok: false, type: 'validation', reason: 'unsupported_type', at: PropertyKey[], valueType: string }
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
			const output = new Array(length)
			for (let index = 0; index < length; index++) {
				if (!Object.hasOwn(current, index)) {
					output[index] = null
					continue
				}
				const childAt = [...at, index]
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
export const toJSONString = implStepPlugin<PluginDef>({
	toJSONString: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep((value) => {
			const prepared = prepareJSON(value)
			if (!prepared.ok) {
				if (prepared.type === 'operation') {
					return failure(createIssue({
						code: 'toJSONString:serialization_failed',
						category: 'operation',
						payload: { value, at: prepared.at, error: prepared.error },
						customMessage: message,
						defaultMessage: 'JSON serialization failed.',
					}))
				}
				const payload = prepared.reason === 'unsupported_type'
					? { reason: prepared.reason, value, at: prepared.at, valueType: prepared.valueType } as const
					: { reason: prepared.reason, value, at: prepared.at } as const
				return failure(createIssue({
					code: 'toJSONString:unserializable',
					payload,
					customMessage: message,
					defaultMessage: 'Value cannot be serialized to JSON.',
				}))
			}

			try {
				const json = JSON.stringify(prepared.value)
				if (typeof json === 'string')
					return success(json)
				return failure(createIssue({
					code: 'toJSONString:unserializable',
					payload: { reason: 'undefined_result', value, at: [] },
					customMessage: message,
					defaultMessage: 'Value cannot be serialized to JSON.',
				}))
			}
			catch (error) {
				return failure(createIssue({
					code: 'toJSONString:serialization_failed',
					category: 'operation',
					payload: { value, at: [], error },
					customMessage: message,
					defaultMessage: 'JSON serialization failed.',
				}))
			}
		})
	},
})
