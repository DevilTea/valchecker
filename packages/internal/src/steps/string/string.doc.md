<!-- step-doc
category: primitives
section: initial
summary: `typeof value === 'string'`
-->

### `string(options?)`

Checks that the value is a string, following `typeof value === 'string'`. The empty string succeeds:
emptiness is a separate condition, expressed by `isNotEmpty()` or `isLengthAtLeast()`.

```ts
v.string()
	.execute('hello')
// { value: 'hello' }

v.string()
	.execute('') // success
v.string()
	.isNotEmpty()
	.execute('') // failure
```

**Issue code:** `string:expected_string` — the value is not a string. Payload `{ value }`.
