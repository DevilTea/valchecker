export const literalMembersMarker = Symbol.for('valchecker.protocol.literalMembers.v1')

/**
 * Stores an owned copy under the well-known key. Only identity-validating
 * steps (accepted set === output set === members) may declare.
 */
export function declareLiteralMembers(
	setMetadata: (key: symbol, value: unknown) => void,
	members: readonly unknown[],
): void {
	setMetadata(literalMembersMarker, [...members])
}

export function getLiteralMembers(schema: { '~core'?: { metadata?: Readonly<Record<symbol, unknown>> | undefined } }): readonly unknown[] | undefined {
	return schema['~core']?.metadata?.[literalMembersMarker] as readonly unknown[] | undefined
}
