<!-- step-doc
category: transforms
section: string
summary: uppercase string
-->

### `toUppercase()`

Converts a string to uppercase by delegating to `String.prototype.toUpperCase`. It does not use the
locale-sensitive `toLocaleUpperCase`.

```ts
v.string()
	.toUppercase()
	.execute('hello')
// { value: 'HELLO' }
```

This pure transformation emits no issue.
