<!-- step-doc
category: transforms
section: json
summary: stringify a value with native `JSON.stringify()` semantics
-->

### `toJSONString(options?)`

Serializes the current value with native `JSON.stringify()` semantics. Object properties whose
values are `undefined`, functions, or symbols are omitted, while those values and sparse holes in an
array become `null`, exactly as they do in the native operation. Boxed primitives, `toJSON()`
methods, getters, Proxies, and cross-realm values are likewise handled by the native serializer.

If native serialization returns `undefined` at the top level, the step fails with
`toJSONString:unserializable`. If `JSON.stringify()` throws — for example for a bigint without a
custom JSON representation, a circular structure, or a throwing getter / Proxy trap / `toJSON()` —
the step catches that exception as `toJSONString:serialization_failed` rather than leaking it into
the core execution boundary.

Use `toStrictJSONString()` when lossy slots should fail instead of following native omission or
coercion semantics.

```ts
v.unknown()
	.toJSONString()
	.execute({ keep: 1, drop: undefined })
// { value: '{"keep":1}' }

v.unknown()
	.toJSONString()
	.execute(undefined)
// failure
```

**Issues:**

- `toJSONString:unserializable` (`validation`) — native `JSON.stringify()` returned `undefined`
  instead of JSON text. Payload `{ reason: 'undefined_result', value, at: [] }`
- `toJSONString:serialization_failed` (`operation`) — native `JSON.stringify()` threw. Payload
  `{ value, at: [], error }`
