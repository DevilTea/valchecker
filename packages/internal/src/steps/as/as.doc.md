<!-- step-doc
category: helpers
section: type-level
summary: compile-time assertion with no runtime validation
-->

### `as<T>()`

Changes only the compile-time output type. It performs no runtime validation or transformation: the
value reaches the result unchanged, whatever it is.

```ts
const schema = v.unknown()
	.as<string>()
```

Use it only when an external invariant already guarantees the asserted type.

This type-level step emits no issue.
