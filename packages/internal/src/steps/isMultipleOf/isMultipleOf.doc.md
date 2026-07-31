<!-- step-doc
category: primitives
section: numeric
summary: divisibility by a number or bigint divisor
-->

### `isMultipleOf(divisor, options?)`

Checks that a number or bigint is a multiple of `divisor`. Bigint inputs use an exact remainder
check. Number inputs accept an exact zero remainder, and otherwise compare the quotient against its
nearest integer within a tolerance of `Number.EPSILON * Math.max(1, Math.abs(quotient)) * 8`, capped
at `1e-10` — enough for ordinary decimal expressions such as `0.3`, or `0.1 + 0.2`, to count as
multiples of `0.1`, without widening into a general nearness check. A non-finite number input fails.

A zero or non-finite number divisor, and a zero bigint divisor, make divisibility meaningless and
throw a `TypeError` while the schema is being constructed. That guard is deliberately asymmetric
with the bound validations, which accept any operand because their naming contract forbids hidden
operand policy.

```ts
v.number()
	.isMultipleOf(0.1)
	.execute(0.1 + 0.2)
// { value: 0.30000000000000004 }

v.bigint()
	.isMultipleOf(3n)
	.execute(9n)
// { value: 9n }

v.number()
	.isMultipleOf(2)
	.execute(Number.POSITIVE_INFINITY)
// failure

v.number()
	.isMultipleOf(0) // throws a TypeError while constructing the schema
```

**Issue code:** `isMultipleOf:expected_multiple_of` — the value is not a multiple of the divisor.
Payload `{ target, value, divisor }`, where `target` is `'number'` or `'bigint'`.
