<!-- step-doc
category: transforms
section: string
summary: split string output
-->

### `toSplit(separator, limit?)`

Delegates to `String.prototype.split` and outputs a string array. The parameters are that method's
own, so `separator` may be a string or a regular expression and `limit` is forwarded unchanged.

```ts
v.string()
	.toSplit(',', 2)
	.execute('a,b,c')
// { value: ['a', 'b'] }
```

This pure transformation emits no issue.
