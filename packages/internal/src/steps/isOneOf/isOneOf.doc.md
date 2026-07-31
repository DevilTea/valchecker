<!-- step-doc
category: primitives
section: equality-and-narrowing
summary: `Object.is` equality against a non-empty tuple of primitives, narrowing to their union
-->

### `isOneOf(values, options?)`

Checks that the value is one of the configured primitives, comparing each candidate with
`Object.is`, so `NaN` equals `NaN` while positive and negative zero differ. As with `isEqualTo()`,
only primitive candidates are accepted, and the method is unavailable in the initial state and for
an output with no primitive member.

A non-empty tuple is required: an empty array is rejected by the type, and a JavaScript caller
passing one gets a `TypeError` while the schema is constructed. The configured values are
snapshotted into a frozen array at construction, so mutating the caller's array afterwards does not
change what the schema accepts, and the failure payload exposes that same frozen snapshot.
Successful output narrows to the union of the members, which is part of the public contract. The
step also advertises its candidates as a finite member set, which is what lets `record()` treat such
a key schema's domain as closed and exhaustive — see [Structures](/api/structures).

```ts
v.string()
	.isOneOf(['red', 'green', 'blue'])
	.execute('red')
// { value: 'red' }, output `'red' | 'green' | 'blue'`

v.string()
	.isOneOf(['a', 'b'], { message: 'Allowed value required' })
	.execute('c')
// failure, payload { value: 'c', expectedValues: ['a', 'b'] }
```

**Issue code:** `isOneOf:expected_one_of` — the value did not match any candidate. Payload
`{ value, expectedValues }`.
