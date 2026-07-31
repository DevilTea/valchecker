<!-- step-doc
category: primitives
section: initial
summary: the value `undefined`
-->

### `undefined(options?)`

Checks that the value is exactly `undefined`. `null` fails — `null()` covers that value. The plugin
is exported as `undefined_` for selective registration, for the same reason `null_` is; the method
it registers is still `v.undefined()`.

```ts
v.undefined()
	.execute(undefined)
// { value: undefined }

v.undefined()
	.execute(null) // failure
```

**Issue code:** `undefined:expected_undefined` — the value is not `undefined`. Payload `{ value }`.
