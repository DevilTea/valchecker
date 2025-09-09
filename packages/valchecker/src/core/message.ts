import type { Simplify } from '../shared'
import type { ValidationIssue } from './schema'

type UnknownErrorIssueCode = 'UNKNOWN_ERROR'
type SchemaMessageFn<IssueCode extends string, Input> = (payload: { code: IssueCode, value: Input, path?: ValidationIssue['path'], error?: unknown }) => string
type SchemaMessageMap<IssueCode extends string, Input> = Simplify<
	& Simplify<Partial<Record<UnknownErrorIssueCode, string | SchemaMessageFn<IssueCode, Input>>>>
	& Simplify<Record<Exclude<IssueCode, UnknownErrorIssueCode>, string | SchemaMessageFn<IssueCode, Input>>>
>
type SchemaMessage<IssueCode extends string, Input> = string | SchemaMessageFn<IssueCode, Input> | Partial<SchemaMessageMap<IssueCode, Input>>

function _resolveMessage({
	payload,
	message,
}: {
	payload: { code: string, value: any, path?: ValidationIssue['path'], error?: unknown }
	message?: SchemaMessage<string, any>
}) {
	if (message == null)
		return void 0

	if (typeof message === 'string')
		return message

	if (typeof message === 'function')
		return message(payload)

	return _resolveMessage({ payload, message: message[payload.code] })
}

const defaultInvalidValueMessage = 'Invalid value.'

function resolveMessage({
	payload,
	defaultMessage,
	message,
}: {
	payload: { code: string, value: any, path?: ValidationIssue['path'], error?: unknown }
	defaultMessage?: SchemaMessage<string, any>
	message?: SchemaMessage<string, any>
}) {
	const _message = _resolveMessage({ payload, message })
	if (_message != null)
		return _message

	const _defaultMessage = _resolveMessage({ payload, message: defaultMessage })
	if (_defaultMessage != null)
		return _defaultMessage

	return defaultInvalidValueMessage
}

export type {
	SchemaMessage,
	UnknownErrorIssueCode,
}

export {
	defaultInvalidValueMessage,
	resolveMessage,
}
