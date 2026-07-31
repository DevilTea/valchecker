<!-- step-doc
category: primitives
section: length-and-inclusion
summary: native `String.prototype.endsWith`
-->

### `isEndingWith(suffix, options?)`

Checks that the string ends with the suffix, following the native `String.prototype.endsWith`. It
adds no policy of its own: the empty suffix matches every string, and the comparison is the method's
plain code-unit comparison, with no case folding or Unicode normalization.

```ts
v.string()
	.isEndingWith('.txt')
	.execute('file.txt')
// { value: 'file.txt' }
```

**Issue code:** `isEndingWith:expected_ending_with` — the string does not end with the suffix.
Payload `{ value, suffix }`.
