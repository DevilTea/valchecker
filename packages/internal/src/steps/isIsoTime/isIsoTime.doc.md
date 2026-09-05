<!-- step-doc
category: formats
section: parsed
summary: bounded ISO `HH:MM:SS` time of day, with no timezone
-->

### `isIsoTime(options?)`

Validates Valchecker's bounded ISO 8601 extended time-of-day profile: `HH:MM:SS`, optional
fractional seconds using either `.` or `,`, and no timezone. Ordinary clock times use hours `00`–`23`,
minutes `00`–`59`, and seconds `00`–`59`.

The ISO 8601 end-of-day instant is also supported as `24:00:00`. A fractional end-of-day expression
is accepted only when every fractional digit is zero, such as `24:00:00.000` or `24:00:00,0`;
`24:00:00.001` is not an end-of-day expression. Leap-second notation (`:60`) is intentionally outside
this lightweight profile, as are basic and reduced-precision time forms. Timezones belong to
`isIsoDateTime`.

```ts
v.string()
	.isIsoTime()
	.execute('12:30:45,125')
// { value: '12:30:45,125' }

v.string()
	.isIsoTime()
	.execute('24:00:00')
// { value: '24:00:00' }
```

**Issue code:** `isIsoTime:expected_iso_time` — the string does not match the supported ISO 8601
time-of-day profile. Payload `{ value }`.
