<!-- step-doc
category: primitives
section: date
summary: `Date` instances, rejecting an Invalid Date
-->

### `date(options?)`

Checks that the value is a `Date` instance and rejects an Invalid Date, and infers a `Date` output.
Like the other initial schemas it opens a pipeline: it is available on the instance, or after an
output that is exactly `unknown` or `any`.

Unlike `instance(Date)` it also rejects an Invalid Date, and it emits its own `date:*` issues rather
than `instance:expected_instance`.

```ts
v.date()
	.execute(new Date('2020-01-01T00:00:00.000Z'))
// success

v.date()
	.execute(new Date('nope'))
// failure
```

**Issues:**

- `date:expected_date` — the value is not a `Date` instance. Payload `{ value }`.
- `date:invalid_date` — the value is a `Date` whose `getTime()` is `NaN`, such as
  `new Date('nope')`. Payload `{ value }`, carrying that `Date`.
