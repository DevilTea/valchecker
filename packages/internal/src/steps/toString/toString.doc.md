<!-- step-doc
category: transforms
section: general-conversion
summary: convert a value through its own `toString` method
-->

### `toString(options?)`

Converts the current value to a string by delegating to the value's own `toString` instance method
(for example `(255).toString(16)`). It deliberately does not use `String(value)` and never consults
`Symbol.toPrimitive`, and it is available after any output that has a `toString` method.

Supply an optional `radix` — forwarded to the instance method, meaningful for `number` and `bigint`,
and ignored by the other built-in `toString` implementations — and an optional `message` in the
trailing options object:

```ts
v.number()
	.toString({ radix: 16 })
	.execute(255)
// { value: 'ff' }
```

**Issue code:** `toString:conversion_failed` (`operation`) — the value's own `toString` method threw.
Payload `{ value, error }`.
