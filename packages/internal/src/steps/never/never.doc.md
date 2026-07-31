<!-- step-doc
category: primitives
section: initial
summary: never succeeds
-->

### `never(options?)`

Fails for every value, including `undefined`, and has output type `never`. No value inhabits that
output type, so nothing downstream can be typed to produce a success either — even `fallback()`,
whose replacement must be assignable to the current output. The step states that a position is not
meant to validate at all.

```ts
v.never()
	.execute(42) // failure
v.never({ message: 'This field is not allowed.' })
	.execute(undefined) // failure
```

**Issue code:** `never:expected_never` — the step rejects every value it is given. Payload
`{ value }`.
