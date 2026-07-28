<!-- step-doc
category: primitives
section: equality-and-narrowing
summary: rejects `null` and `undefined` and removes both from the output
-->

### `isNonNullish(options?)`

Checks that the value is neither `null` nor `undefined`, and narrows the output by removing both.
That is the whole difference between the three nullish narrowings: `isNonNullish()` removes both,
while `isDefined()` removes only `undefined` and `isNonNull()` removes only `null`.

The method is offered only when the current output can actually be nullish, so
`v.string().isNonNullish()` does not exist. After an `unknown` output it narrows to
`NonNullable<unknown>`.

```ts
v.union([v.string(), v.null(), v.undefined()])
	.isNonNullish()
	.execute('value')
// { value: 'value' }, output `string`
```

**Issue code:** `isNonNullish:expected_non_nullish` — the value is `null` or `undefined`. Payload
`{ value }`, whose `value` is the nullish value that was observed.
