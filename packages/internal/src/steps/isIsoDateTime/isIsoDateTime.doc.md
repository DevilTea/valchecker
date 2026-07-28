<!-- step-doc
category: formats
section: parsed
summary: a date and time joined by `T`, with an optional offset
-->

### `isIsoDateTime(options?)`

Validates an ISO 8601 date and time joined by `T`, with optional fractional seconds and an optional
`Z` or `±HH:MM` offset, and rejects impossible values. Month lengths and the leap-year rule are part
of the accepted shape for the date portion, as are the field ranges for the time portion and the
offset, so `2026-02-30`, `2023-02-29`, and `24:00:00` are all rejected. The date grammar comes from
`isIsoDate` and the time and offset grammars from `isIsoTime`, each a single shared definition, so
the accepted shapes cannot drift apart.

```ts
v.string()
	.isIsoDateTime()
	.execute('2026-07-23T12:30:00Z')
// { value: '2026-07-23T12:30:00Z' }

v.string()
	.isIsoDateTime()
	.execute('2026-07-23T12:30:00+08:00')
// { value: '2026-07-23T12:30:00+08:00' }
```

**Issue code:** `isIsoDateTime:expected_iso_date_time` — the string is not a valid ISO 8601
date-time. Payload `{ value }`.
