<!-- step-doc
category: primitives
section: length-and-inclusion
summary: native string, array, or Set inclusion semantics
-->

### `isIncluding(value, options?)`

Checks that a string, an array, or a Set includes the value, using the native operation for
whichever of the three the current output is: `String.prototype.includes` for a string,
`Array.prototype.includes` for an array, and `Set.prototype.has` for a Set. A string search is
therefore a substring test, while arrays and Sets compare with SameValueZero, so `NaN` matches
`NaN` and `0` matches `-0`.

The options object carries the one option the matching native call accepts alongside `message`:
`position` for a string, the index the substring search starts from, and `fromIndex` for an array.
A Map is not accepted, because it has no unambiguous membership domain — use `isIncludingKey()` or
`isIncludingValue()`, on [Structures](/api/structures), which name the searched domain explicitly.

```ts
v.string()
	.isIncluding('lo')
	.execute('hello')
// { value: 'hello' }

v.array(v.number())
	.isIncluding(Number.NaN)
	.execute([1, Number.NaN])
// { value: [1, NaN] }

v.set(v.string())
	.isIncluding('required', { message: 'The "required" tag is mandatory.' })
```

**Issue code:** `isIncluding:expected_including` — the value is not included. The payload names
the searched value `expected` for every variant and discriminates on `target`, so it is one of
`{ target: 'string', value, expected, position }`,
`{ target: 'array', value, expected, fromIndex }`, and `{ target: 'set', value, expected }`.
