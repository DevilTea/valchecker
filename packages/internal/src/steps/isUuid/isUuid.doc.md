<!-- step-doc
category: formats
section: pattern
summary: RFC 9562 / RFC 4122 UUID, versions 1–8 plus nil and max
-->

### `isUuid(options?)`

RFC 9562 / RFC 4122 UUID. Accepts versions 1–8 with a canonical variant nibble, plus the special nil
and max UUIDs. Case-insensitive.

```ts
v.string()
	.isUuid()
	.execute('123e4567-e89b-12d3-a456-426614174000')
// { value: '123e4567-e89b-12d3-a456-426614174000' }
```

**Issue code:** `isUuid:expected_uuid` — the string is not a valid UUID. Payload `{ value }`.
