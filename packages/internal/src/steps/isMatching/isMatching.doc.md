<!-- step-doc
category: primitives
section: length-and-inclusion
summary: regular-expression matching with deterministic state reset
-->

### `isMatching(pattern, options?)`

Checks that the string matches the regular expression. The pattern is snapshotted while the schema
is constructed: its `source` and `flags` are copied into a frozen record, and the schema tests
against a fresh `RegExp` built from that snapshot. Before and after each test `lastIndex` is reset
to `0`. Both together make repeated executions deterministic — a stateful `g` or `y` pattern
cannot carry a match position from one execution into the next, and mutating the caller's `RegExp`
afterwards cannot change what the schema tests. A non-`RegExp` pattern throws a `TypeError` while
the schema is constructed.

```ts
v.string()
	.isMatching(/^\d+$/)
	.execute('123')
// { value: '123' }

v.string()
	.isMatching(/^foo$/i, { message: 'Expected foo.' })
	.execute('bar')
// failure
```

**Issue code:** `isMatching:expected_matching` — the string does not match the pattern. Payload
`{ value, pattern }`, where `pattern` is the frozen `{ source, flags }` snapshot rather than the
`RegExp` itself.
