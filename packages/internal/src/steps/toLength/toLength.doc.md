<!-- step-doc
category: transforms
section: array
summary: length output
-->

### `toLength()`

Replaces a length-bearing value with its numeric `length`. It is available after any output carrying
a numeric `length`, so both a string and an array qualify.

```ts
v.array(v.number())
	.toLength()
	.execute([1, 2, 3])
// { value: 3 }
```

This pure transformation emits no issue.
