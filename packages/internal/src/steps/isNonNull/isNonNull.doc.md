<!-- step-doc
category: primitives
section: equality-and-narrowing
summary: rejects `null` and removes it from the output, preserving `undefined`
-->

### `isNonNull(options?)`

Checks that the value is not `null`, and narrows the output by removing `null`. An `undefined` value
passes and is preserved — that is the whole difference between the three nullish narrowings:
`isNonNull()` removes `null`, `isDefined()` removes `undefined`, and `isNonNullish()` removes both.

The method is offered only when the current output can actually be `null`, so
`v.string().isNonNull()` does not exist. After an `unknown` output it narrows to
`NonNullable<unknown> | undefined`.

```ts
v.union([v.string(), v.null(), v.undefined()])
	.isNonNull()
	.execute(undefined)
// { value: undefined }, output `string | undefined`
```

**Issue code:** `isNonNull:expected_non_null` — the value is `null`. Payload `{ value }`, whose
`value` is always `null`.
