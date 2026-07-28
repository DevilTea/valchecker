<!-- step-doc
category: primitives
section: loose
summary: a `bigint` or a `${bigint}` string, normalized to `bigint`
-->

### `looseBigint(options?)`

Accepts a bigint, or a string TypeScript accepts as `${bigint}`, and normalizes the output to a
bigint. The string grammar is an optional `-` sign, then either a decimal without leading zeros or a
`0x`, `0b`, or `0o` radix literal, with the prefix and hex digits in either case. There are no
numeric separators and no trailing `n`, so `'0x10'` yields `16n` and `'-0x10'` yields `-16n`, while
`'01'`, `'1.0'`, `'1e3'`, and `'1n'` are rejected.

This is not `looseNumber()`'s grammar: a leading `+` and surrounding whitespace are accepted there
and rejected here.

```ts
v.looseBigint()
	.execute('0x10') // { value: 16n }
v.looseBigint()
	.execute('-0x10') // { value: -16n }
v.looseBigint()
	.execute('01') // failure
v.looseBigint()
	.execute('1.0') // failure
```

`templateLiteral()` reads its `${bigint}` placeholders from this same grammar, so a placeholder and
this step accept exactly the same strings.

**Issue code:** `looseBigint:expected_bigint` — the value is neither a bigint nor a
TypeScript-compatible bigint string. Payload `{ value }`.
