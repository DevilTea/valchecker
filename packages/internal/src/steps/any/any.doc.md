<!-- step-doc
category: primitives
section: initial
summary: passthrough typed as `any`
-->

### `any()`

Accepts every value and performs no runtime check. The output type is `any`, which opts the rest of
the pipeline out of type checking. `unknown()` is the same runtime passthrough with an `unknown`
output type.

```ts
v.any()
	.execute('anything')
// { value: 'anything' }
```

**Issues:** none. The step performs no check, so it cannot fail.
