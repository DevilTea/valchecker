<!-- step-doc
category: primitives
section: date
summary: strictly before a `Date` bound
-->

### `isBefore(bound, options?)`

Checks that a `Date` is strictly before `bound`, a `Date`, comparing `getTime()` values. The bound
itself is rejected. Only the strict variant exists; pass an adjusted bound when an inclusive edge is
required.

An Invalid Date bound is not rejected at construction: every value then fails with this step's own
issue, and the default message renders the bound as `Invalid Date`.

```ts
v.date()
	.isBefore(new Date('2020-01-02T00:00:00.000Z'))
	.execute(new Date('2020-01-01T00:00:00.000Z'))
// success

v.date()
	.isBefore(new Date('2020-01-02T00:00:00.000Z'))
	.execute(new Date('2020-01-02T00:00:00.000Z'))
// failure
```

**Issue code:** `isBefore:expected_before` — the value is not before the bound. Payload
`{ value, bound }`.
