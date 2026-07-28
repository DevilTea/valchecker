<!-- step-doc
category: transforms
section: string
summary: lowercase string
-->

### `toLowercase()`

Converts a string to lowercase by delegating to `String.prototype.toLowerCase`. It does not use the
locale-sensitive `toLocaleLowerCase`.

```ts
v.string()
	.toLowercase()
	.execute('HELLO')
// { value: 'hello' }
```

This pure transformation emits no issue.
