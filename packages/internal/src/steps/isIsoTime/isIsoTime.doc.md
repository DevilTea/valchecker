<!-- step-doc
category: formats
section: parsed
summary: `HH:MM:SS` time of day, with no time-zone
-->

### `isIsoTime(options?)`

Validates the ISO 8601 time-of-day shape `HH:MM:SS`, with optional fractional seconds and no
time-zone, and rejects impossible values. The field ranges (00–23, 00–59, 00–59) are part of the
accepted shape, so `24:00:00` is rejected. The time grammar has a single definition, shared with the
time portion of `isIsoDateTime`, so the two accepted shapes cannot drift apart.

```ts
v.string()
	.isIsoTime()
	.execute('12:30:45.123')
// { value: '12:30:45.123' }

v.string()
	.isIsoTime()
	.execute('24:00:00')
// failure
```

**Issue code:** `isIsoTime:expected_iso_time` — the string is not a valid ISO 8601 time. Payload
`{ value }`.
