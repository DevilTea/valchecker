<!-- step-doc
category: transforms
section: string
summary: Unicode normalization
-->

### `toNormalized(options?)`

Normalizes a string with `String.prototype.normalize`. `form` may be `NFC`, `NFD`, `NFKC`, or
`NFKD`; the default is `NFC`.

This pure transformation does not emit an issue. An unsupported form supplied by a JavaScript caller
is rejected while constructing the schema, with a `TypeError` rather than an execution failure.

```ts
v.string()
	.toNormalized({ form: 'NFC' })
	.execute('e\u0301')
// { value: 'é' }
```
