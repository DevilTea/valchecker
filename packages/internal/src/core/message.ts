import type { MessageHandler } from './types'

/**
 * Captures a message handler at schema or Valchecker construction time.
 *
 * Scalar handlers are already values that the caller cannot replace through a
 * containing configuration object once read. Map handlers need a shallow
 * container snapshot so later entry replacement or deletion cannot change the
 * resolver. The entries themselves are intentionally not cloned: callbacks
 * retain their identity and live closure state.
 */
export function snapshotMessage<Message extends MessageHandler<any> | undefined>(
	message: Message,
): Message {
	if (message == null || typeof message !== 'object')
		return message

	const snapshot = Object.create(null) as Record<string, unknown>
	for (const key of Object.getOwnPropertyNames(message)) {
		const descriptor = Object.getOwnPropertyDescriptor(message, key)!
		Object.defineProperty(snapshot, key, {
			configurable: true,
			enumerable: descriptor.enumerable,
			value: Reflect.get(message, key),
			writable: true,
		})
	}
	return snapshot as Message
}

/**
 * Captures only the message-bearing surface of step options while preserving an
 * options-shaped closure for the execution hot path. Returning `undefined` for
 * omitted options keeps the common no-options path allocation-free.
 */
export function snapshotMessageOptions(
	options: { readonly message?: MessageHandler<any> | undefined } | undefined,
): { readonly message: MessageHandler<any> | undefined } | undefined {
	return options && { message: snapshotMessage(options.message) }
}
