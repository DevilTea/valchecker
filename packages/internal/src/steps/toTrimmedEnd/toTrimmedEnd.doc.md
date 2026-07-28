<!-- step-doc
category: transforms
section: string
summary: trim the end
-->

### `toTrimmedEnd()`

Trims whitespace from the end of the string by delegating to `String.prototype.trimEnd`.

```ts
v.string()
	.toTrimmedEnd()
	.execute('  hello  ')
// { value: '  hello' }
```

This pure transformation emits no issue.
