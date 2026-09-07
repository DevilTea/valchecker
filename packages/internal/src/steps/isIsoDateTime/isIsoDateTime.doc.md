<!-- step-doc
category: formats
section: parsed
summary: bounded ISO extended calendar date-time with optional offset
-->

### `isIsoDateTime(options?)`

Validates Valchecker's bounded ISO 8601 extended calendar date-time profile:
`YYYY-MM-DDTHH:MM:SS`, with optional fractional seconds using either `.` or `,`, plus an optional `Z`
or `±HH:MM` offset. The date uses the same proleptic Gregorian rules as `isIsoDate`, including valid
year-zero leap day `0000-02-29`.

The time portion also supports ISO's end-of-day instant `24:00:00`; if it has a fraction, every
fractional digit must be zero. Time-of-day and UTC-offset grammars are deliberately separate, so this
support never admits `+24:00` or `-24:00` offsets. Leap-second notation (`:60`) is intentionally
excluded because validating it semantically would require UTC leap-second date and offset knowledge
outside this lightweight format validator.

The API intentionally stays within this extended-calendar shape. ISO basic forms, week dates,
ordinal dates, reduced precision, signed/expanded years, timezone names, and other ISO 8601 profiles
remain outside this method.

```ts
v.string()
	.isIsoDateTime()
	.execute('2026-07-23T12:30:00,5+08:00')
// { value: '2026-07-23T12:30:00,5+08:00' }

v.string()
	.isIsoDateTime()
	.execute('2026-07-23T24:00:00Z')
// { value: '2026-07-23T24:00:00Z' }
```

**Issue code:** `isIsoDateTime:expected_iso_date_time` — the string does not match the supported ISO
8601 extended calendar date-time profile. Payload `{ value }`.
