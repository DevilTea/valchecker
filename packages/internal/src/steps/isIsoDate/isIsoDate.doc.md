<!-- step-doc
category: formats
section: parsed
summary: `YYYY-MM-DD` calendar date, with impossible dates rejected
-->

### `isIsoDate(options?)`

Validates the ISO 8601 calendar-date shape `YYYY-MM-DD` and rejects impossible values. Month lengths
and the leap-year rule are part of the accepted shape, so `2026-02-30` and `2023-02-29` are both
rejected. The calendar grammar has a single definition, shared with `isIsoDateTime`, so the two
accepted shapes cannot drift apart.

```ts
v.string()
	.isIsoDate()
	.execute('2026-07-23')
// { value: '2026-07-23' }

v.string()
	.isIsoDate()
	.execute('2026-02-30')
// failure
```

**Issue code:** `isIsoDate:expected_iso_date` — the string is not a valid ISO 8601 date. Payload
`{ value }`.
