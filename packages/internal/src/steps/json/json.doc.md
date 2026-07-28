<!-- step-doc
category: primitives
section: json
summary: a string that parses as JSON, preserving the string
-->

### `json(options?)`

Checks that the current string is parseable JSON while preserving the string: the output stays the
original text, not the parsed value. It parses with `JSON.parse` and discards the result, so any
top-level JSON value — object, array, string, number, boolean, or `null` — is accepted, and the
empty string is not. Use `toJSONValue()` when the parsed value is what the pipeline needs.

```ts
v.string()
	.json()
	.execute('{"name":"John"}')
// { value: '{"name":"John"}' }

v.string()
	.json()
	.execute('{invalid}')
// failure
```

**Issue code:** `json:invalid_json` — `JSON.parse` threw on the string. Payload
`{ value, error }`, where `error` is the thrown value.
