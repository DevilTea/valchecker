<!-- step-doc
category: primitives
section: template-literal
summary: an assembled TypeScript template-literal type, matched as the checker matches it
-->

### `templateLiteral(parts, options?)`

Validates a string against an assembled TypeScript template-literal type and infers that exact
output type. Each part is either an interpolatable literal
(`string | number | bigint | boolean | null | undefined`) or a bare interpolatable initial schema —
`string()`, `number()`, `bigint()`, `boolean()`, `literal()`, `null()`, `undefined()`, `union()`, or
a nested `templateLiteral()`. Union parts expand into a cross-product union.

```ts
v.templateLiteral(['ID-', v.number()]) // output `ID-${number}`
v.templateLiteral([v.number(), v.union(['px', 'em'])])
// output `${number}px` | `${number}em`
```

Matching mirrors the TypeScript checker's placeholder split rule rather than a regular expression:
the leftmost delimiter wins, adjacent placeholders capture exactly one character, and there is no
backtracking. `${number}` and `${bigint}` placeholders use the grammars `looseNumber()` and
`looseBigint()` own, so a placeholder and the corresponding schema accept exactly the same strings.

```ts
v.templateLiteral([v.string(), 'x', v.number()])
	.execute('axbx1') // failure: the leftmost `x` leaves `bx1` for the number slot
v.templateLiteral([v.string(), v.number()])
	.execute('abc1') // failure: an adjacent string slot captures a single character
v.templateLiteral([v.string(), v.string()])
	.execute('anything') // success: an all-string template reduces to `string`
```

It is an initial schema, so it is unavailable after a step that already produced a concrete output.

Construction throws a `TypeError` instead of deferring the problem to execution: for a `parts`
argument that is not an array, a symbol part, a non-finite number part, a value that is not
interpolatable, a schema part carrying no template-literal representation — which includes a refined
or chained schema such as `v.string().toTrimmed()`, because a further step drops the construction
metadata the part is recognized by — and a cross product over 10000 members.

**Issue code:** `templateLiteral:expected_template_literal` — the value is not a string, or is a
string that does not match the assembled template. Payload `{ value, template }`, where `template`
is the canonical rendering of the whole template, for example `` `${"a" | "b"}-${1 | 2}` ``.
