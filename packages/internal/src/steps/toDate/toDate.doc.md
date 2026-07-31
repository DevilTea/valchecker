<!-- step-doc
category: transforms
section: primitive-conversion
summary: `Date` from epoch milliseconds or any string accepted by `new Date(value)`
-->

### `toDate(options?)`

Converts a `number` (epoch milliseconds) or any `string` the host `Date` constructor accepts to a
`Date` with `new Date(value)`. The method is available after a `string | number` output.

A native exception, or a result that is an Invalid Date (for example from an unparseable string,
from the empty string, or from `NaN`), becomes `toDate:conversion_failed`.

```ts
v.string()
	.toDate()
	.execute('2020-01-01') // { value: Date }

v.number()
	.toDate()
	.execute(0) // { value: Date }

v.string()
	.toDate()
	.execute('nope') // failure
```

**Issue code:** `toDate:conversion_failed` (`operation`) — `new Date(value)` threw or produced an
Invalid Date. Payload `{ value, error }`, where `error` holds the thrown exception when the native
conversion threw and is `undefined` for an Invalid Date result.
