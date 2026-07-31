<!-- step-doc
category: primitives
section: initial
summary: passthrough typed as `unknown`
-->

### `unknown()`

Accepts every value and performs no runtime check. The output type is `unknown`, which keeps the
value opaque until a later step narrows it — `use()`, `check()` with a type guard, or `as<T>()`.

```ts
v.unknown()
	.execute('anything')
// { value: 'anything' }
```

**Issues:** none. The step performs no check, so it cannot fail.
