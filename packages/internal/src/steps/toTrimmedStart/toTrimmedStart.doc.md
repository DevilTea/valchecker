<!-- step-doc
category: transforms
section: string
summary: trim the start
-->

### `toTrimmedStart()`

Trims whitespace from the beginning of the string by delegating to `String.prototype.trimStart`.

```ts
v.string()
	.toTrimmedStart()
	.execute('  hello  ')
// { value: 'hello  ' }
```

This pure transformation emits no issue.
