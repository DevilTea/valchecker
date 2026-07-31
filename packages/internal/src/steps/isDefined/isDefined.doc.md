<!-- step-doc
category: primitives
section: equality-and-narrowing
summary: rejects `undefined` and removes it from the output, preserving `null`
-->

### `isDefined(options?)`

Checks that the value is not `undefined`, and narrows the output by removing `undefined`. A `null`
value passes and is preserved — that is the whole difference between the three nullish narrowings:
`isDefined()` removes `undefined`, `isNonNull()` removes `null`, and `isNonNullish()` removes both.

The method is offered only when the current output can actually be `undefined`, so
`v.string().isDefined()` does not exist. After an `unknown` output it narrows to
`NonNullable<unknown> | null`.

```ts
v.union([v.string(), v.null(), v.undefined()])
	.isDefined()
	.execute(null)
// { value: null }, output `string | null`
```

**Issue code:** `isDefined:expected_defined` — the value is `undefined`. Payload `{ value }`,
whose `value` is always `undefined`.
