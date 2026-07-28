<!-- step-doc
category: primitives
section: initial
summary: exact literal match with `Object.is`
-->

### `literal(value, options?)`

Checks that the value matches the configured literal with `Object.is`, so `NaN` matches `NaN` while
`0` and `-0` are distinct. The expected literal is a string, number, boolean, bigint, or symbol, and
the successful output narrows to that literal type.

```ts
v.literal('hello')
	.execute('hello')
// { value: 'hello' }

v.literal(42)
	.execute(43) // failure
```

**Issue code:** `literal:expected_literal` — the value does not match the expected literal. Payload
`{ value, expected }`.
