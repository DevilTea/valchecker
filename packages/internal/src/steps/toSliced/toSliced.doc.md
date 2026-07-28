<!-- step-doc
category: transforms
section: array
summary: sliced output
-->

### `toSliced(start, end?)`

Forwards its arguments to the current value's `slice` method, so it is available after any output
that has one — a string or an array in practice — and its parameters and output type are that
method's own. Out-of-range and negative indices therefore behave exactly as the native method does.

```ts
v.array(v.number())
	.toSliced(1, 4)
	.execute([1, 2, 3, 4, 5])
// { value: [2, 3, 4] }

v.string()
	.toSliced(1, 4)
	.execute('hello')
// { value: 'ell' }
```

This pure transformation emits no issue.
