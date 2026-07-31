<!-- step-doc
category: transforms
section: json
summary: stringify a supported value with JSON semantics
-->

### `toJSONString(options?)`

Serializes a supported value with JSON semantics after a single-read preflight: the value is walked
once, and the plain copy that walk produces is what `JSON.stringify` receives, so a getter, a
`toJSON` method, or a Proxy trap runs exactly once. Inherited and symbol-keyed properties are
ignored, boxed string/number/boolean values are unboxed, and `NaN` or infinity serialize as `null`.

Lossy slots are treated uniformly and strictly: an explicit `undefined`, a `function` or `symbol`
value, and a sparse array hole all fail rather than being silently coerced. A hole fails with
`toJSONString:unserializable` carrying `{ reason: 'undefined_result' }` at the hole's path, the same
as an explicit `undefined` element. (Native `JSON.stringify` would instead write `null` for a hole.)

```ts
v.unknown()
	.toJSONString()
	.execute({ value: 42 })
// { value: '{"value":42}' }

v.unknown()
	.toJSONString()
	.execute([1, undefined, 3])
// failure, at [1]
```

**Issues:**

- `toJSONString:unserializable` (`validation`) — the value, or a nested slot, has no JSON
  representation. Payload `{ reason, value, at, valueType? }`, where `reason` is
  `'undefined_result'`, `'unsupported_type'`, or `'circular_reference'`, `at` is the path of the
  offending slot, and `valueType` is present only for `'unsupported_type'`, where it is `'bigint'`,
  `'function'`, or `'symbol'`
- `toJSONString:serialization_failed` (`operation`) — a getter, a Proxy trap, or a `toJSON` method
  threw while the value was being read. Payload `{ value, at, error }`
