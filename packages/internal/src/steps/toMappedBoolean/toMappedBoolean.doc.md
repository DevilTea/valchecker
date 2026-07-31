<!-- step-doc
category: transforms
section: primitive-conversion
summary: explicit true/false value mappings for string, number, or bigint
-->

### `toMappedBoolean(options)`

Maps configured string, number, or bigint values to booleans without coercion, trimming, or case
normalization. It is the explicit alternative to `toBoolean()` truthiness, is available after a
`string | number | bigint` output, and the configured values must have the current output type.

```ts
v.string()
	.toMappedBoolean({
		trueValues: ['Y', 'yes'],
		falseValues: ['N', 'no'],
		message: 'Expected a configured boolean value.',
	})
```

Mappings use SameValueZero equality, so `NaN` matches `NaN` and `-0` matches `0`. Configuration
arrays are immutable schema-time snapshots: mutating an array afterwards does not change the schema,
and the snapshot is what the failure payload reports. Supplying two empty mappings, or a value that
appears in both, throws a `TypeError` while the schema is constructed; a one-sided mapping is
allowed.

**Issue code:** `toMappedBoolean:unmapped_value` — the value matches no configured mapping. Payload
`{ value, trueValues, falseValues }`.
