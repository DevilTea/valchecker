<!-- step-doc
category: primitives
section: initial
summary: `typeof value === 'symbol'`
-->

### `symbol(options?)`

Checks that the value is a symbol, following `typeof value === 'symbol'`. Both an anonymous symbol
and one with a description succeed, and the step reads nothing but the type: use `literal(symbol)`
to require one particular symbol.

```ts
v.symbol()
	.execute(Symbol('id'))
// { value: Symbol(id) }

v.symbol()
	.execute('id') // failure
```

**Issue code:** `symbol:expected_symbol` — the value is not a symbol. Payload `{ value }`.
