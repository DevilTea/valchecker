<!-- step-doc
category: primitives
section: loose
summary: a `number` or a `${number}` string, normalized to `number`
-->

### `looseNumber(options?)`

Accepts a number, or a string TypeScript accepts as `${number}`, and normalizes the output to a
number. A number passes through unchanged, including `NaN`, `Infinity`, and `-Infinity` — the step
has no more finite-number policy than `number()` does.

The string grammar is TypeScript's, not `Number()`'s: it is `Number.isFinite(+string)` on a
non-empty string. So `'+1'`, `'.5'`, `'5.'`, `'1e3'`, and `'0x10'` are accepted, and in accordance
with TypeScript's `${number}` behavior a non-empty whitespace-only string is accepted and normalizes
to `0` while the empty string is rejected. `'NaN'`, `'Infinity'`, `'1_000'`, and `'1e999'` are
rejected even though the corresponding numbers, where they exist, are valid inputs.

```ts
v.looseNumber()
	.execute('42') // { value: 42 }
v.looseNumber()
	.execute('   ') // { value: 0 }
v.looseNumber()
	.execute('') // failure
v.looseNumber()
	.execute('Infinity') // failure
v.looseNumber()
	.execute(Number.POSITIVE_INFINITY) // success
```

`templateLiteral()` reads its `${number}` placeholders from this same grammar, so a placeholder and
this step accept exactly the same strings.

**Issue code:** `looseNumber:expected_number` — the value is neither a number nor a
TypeScript-compatible number string. Payload `{ value }`.
