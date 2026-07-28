<!-- step-doc
category: transforms
section: string
summary: trim both ends
-->

### `toTrimmed()`

Trims whitespace from both ends of the string by delegating to `String.prototype.trim`.

```ts
v.string()
	.toTrimmed()
	.execute('  hello  ')
// { value: 'hello' }
```

This pure transformation emits no issue.
