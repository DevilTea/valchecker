<!-- step-doc
category: formats
section: parsed
summary: bounded ISO `YYYY-MM-DD` calendar dates
-->

### `isIsoDate(options?)`

Validates Valchecker's bounded ISO 8601 extended-calendar date profile: exactly `YYYY-MM-DD` with
four decimal year digits. Month lengths and the proleptic Gregorian leap-year rule are enforced,
including year `0000`, so `0000-02-29` is valid while `1900-02-29`, `2023-02-29`, and
`2026-02-30` are rejected. The calendar grammar is shared with `isIsoDateTime`.

This method intentionally does **not** implement every ISO 8601 representation. Basic dates such as
`20260723`, week dates, ordinal dates, reduced-precision dates, signed/expanded years, and other ISO
profiles are outside this API shape.

```ts
v.string()
	.isIsoDate()
	.execute('0000-02-29')
// { value: '0000-02-29' }

v.string()
	.isIsoDate()
	.execute('2026-02-30')
// failure
```

**Issue code:** `isIsoDate:expected_iso_date` — the string does not match the supported ISO 8601
calendar-date profile. Payload `{ value }`.
