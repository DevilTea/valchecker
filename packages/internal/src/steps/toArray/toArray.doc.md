<!-- step-doc
category: transforms
section: collection
summary: convert a Set to an item array
-->

### `toArray()`

Replaces a Set with a new array of its items in insertion order. This synchronous transformation
does not mutate the source Set and emits no issue.

```ts
v.set(v.string())
	.toArray()
	.execute(new Set(['b', 'a']))
// { value: ['b', 'a'] }
```
