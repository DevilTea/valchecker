export const literalMembersMarker = Symbol.for('valchecker:literalMembers')

/**
 * Freezes a copy and stores it under the well-known key. Only identity-validating
 * steps (accepted set === output set === members) may declare.
 */
export function declareLiteralMembers(
	setMetadata: (key: symbol, value: unknown) => void,
	members: readonly unknown[],
): void {
	setMetadata(literalMembersMarker, Object.freeze([...members]))
}

export function getLiteralMembers(schema: { '~core'?: { metadata?: Readonly<Record<symbol, unknown>> | undefined } }): readonly unknown[] | undefined {
	return schema['~core']?.metadata?.[literalMembersMarker] as readonly unknown[] | undefined
}
