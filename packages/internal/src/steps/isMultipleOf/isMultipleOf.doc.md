<!-- step-doc
category: primitives
section: numeric
summary: divisibility by a number or bigint divisor
-->

### `isMultipleOf(divisor, options?)`

Checks that a number or bigint is a multiple of `divisor`. Bigint inputs use an exact remainder
check. Number inputs accept an exact zero remainder. Otherwise they reconstruct the nearest integer
multiple as `Math.round(value / divisor) * divisor` and compare it with `value` using a tolerance of
`Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(reconstructed)) * 8`. This scales with the
IEEE-754 magnitude being compared, so ordinary decimal expressions such as `0.3`, `0.1 + 0.2`, and
larger-quotient decimal multiples are not rejected by an arbitrary absolute cap. It is still a
floating-point representation tolerance, not an arbitrary-precision decimal or general nearness
check. A non-finite input, or a non-finite quotient/reconstruction on the inexact path, fails.

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
