<!-- step-doc
category: helpers
section: escape-hatches
summary: generic custom output transformation escape hatch
-->

### `transform(fn, options?)`

`transform()` is the generic arbitrary-output escape hatch, for an output change no `toXxx` step
expresses. The inferred output follows the callback result. The callback may return a direct or a
supported asynchronous value; a promise-like result makes the schema maybe-async.

```ts
const schema = v.string()
	.toTrimmed()
	.transform(value => ({ value }))
```

Type-changing transforms flow into subsequent state-aware methods:

```ts
const tags = v.string()
	.toSplit(',')
	.toMapped(value => value.trim())
	.toFiltered(value => value.length > 0)
```

**Issue code:** `transform:callback_failed` (`operation`) — the callback threw or rejected. Payload
`{ phase, value, error }`, where `phase` is `'throw'` or `'reject'`.
