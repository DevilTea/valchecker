<!-- step-doc
category: transforms
section: json
summary: parse a JSON string with `JSON.parse`
-->

### `toJSONValue<T = unknown>(options?)`

Parses a JSON string with `JSON.parse`. The method is available after a `string` output.

The generic type parameter is an output assertion, not a check: it changes the inferred output type
and nothing about what runs. Use `use()` after parsing when the parsed structure must also be
validated.

```ts
v.string()
	.toJSONValue<{ value: number }>()
	.execute('{"value":42}')
// { value: { value: 42 } }

v.string()
	.toJSONValue()
	.execute('{')
// failure
```

**Issue code:** `toJSONValue:invalid_json` — `JSON.parse` threw on the string. Payload
`{ value, error }`, where `error` is the `SyntaxError` it threw.
