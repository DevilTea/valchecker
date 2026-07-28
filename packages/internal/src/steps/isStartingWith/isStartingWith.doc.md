<!-- step-doc
category: primitives
section: length-and-inclusion
summary: native `String.prototype.startsWith`
-->

### `isStartingWith(prefix, options?)`

Checks that the string starts with the prefix, following the native `String.prototype.startsWith`.
It adds no policy of its own: the empty prefix matches every string, and the comparison is the
method's plain code-unit comparison, with no case folding or Unicode normalization.

```ts
v.string()
	.isStartingWith('hello')
	.execute('hello world')
// { value: 'hello world' }
```

**Issue code:** `isStartingWith:expected_starting_with` — the string does not start with the
prefix. Payload `{ value, prefix }`.
