<!-- step-doc
category: transforms
section: primitive-conversion
summary: native `Boolean(value)` truthiness conversion
-->

### `toBoolean()`

Converts the current value with JavaScript's native `Boolean()` truthiness coercion. It does not
parse semantic boolean strings: the non-empty strings `'false'`, `'0'`, and `'no'` all convert to
`true`. Reach for `toMappedBoolean()` when the accepted representations must be declared.

The method is available after any output that is not already `boolean`, so the identity conversion
`boolean().toBoolean()` is not offered. It takes no options, because it cannot fail.

```ts
v.string()
	.toBoolean()
	.execute('false')
// { value: true }

v.string()
	.toBoolean()
	.execute('')
// { value: false }
```

This pure conversion emits no issue.
