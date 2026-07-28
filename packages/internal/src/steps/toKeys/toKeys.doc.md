<!-- step-doc
category: transforms
section: collection
summary: Map keys as an array
-->

### `toKeys()`

Replaces a Map with a new array of its keys in insertion order. This representation transform is
synchronous, emits no new issue, and does not mutate the source collection.

```ts
v.map({ key: v.string(), value: v.number() })
	.toKeys()
	.execute(new Map([['b', 2], ['a', 1]]))
// { value: ['b', 'a'] }
```
