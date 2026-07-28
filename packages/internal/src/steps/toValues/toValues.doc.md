<!-- step-doc
category: transforms
section: collection
summary: Map values as an array
-->

### `toValues()`

Replaces a Map with a new array of its values in insertion order. This representation transform is
synchronous, emits no new issue, and does not mutate the source collection.

```ts
v.map({ key: v.string(), value: v.number() })
	.toValues()
	.execute(new Map([['b', 2], ['a', 1]]))
// { value: [2, 1] }, inferred as `number[]`
```
