# Structures

Structural validators compose nested schemas. Exact traversal, output, options, paths, issue codes, and edge cases belong to each generated step entry.

For task-oriented composition, use [Structured Data](/guides-recipes/structured-data). For the cross-cutting path/provenance model, use [Issues and Paths](/core-concepts/issues-and-paths). Formal compatibility guarantees are in the [Valchecker 1.0 Contract](/reference/v1-contract#structural-composition-guarantees).

<!-- typecheck-prelude
declare const createValchecker: typeof import('valchecker').createValchecker
declare const union: typeof import('valchecker').union
declare const literal: typeof import('valchecker').literal
declare const null_: typeof import('valchecker').null_
declare const undefined_: typeof import('valchecker').undefined_
declare const number: typeof import('valchecker').number
declare const isGreaterThan: typeof import('valchecker').isGreaterThan
-->

## Object schemas

<!-- steps: objects -->

### Optional fields

Wrap a schema in a one-element tuple:

```ts
const schema = v.object({
	required: v.string(),
	optional: [v.number()],
})
```

The input property may be absent. The declared output property is `undefined` when absent.

This one-element-array shorthand is scoped to object property position. It does not collide with `tuple()`, whose argument is the whole element array; a one-element `tuple([schema])` is a 1-tuple, never an optional field.

### Safe `__proto__` fields

A declared `__proto__` key is written as an own enumerable data property. Valchecker does not invoke the legacy prototype setter. `record()` writes an own `__proto__` key the same way.

## Collections

<!-- steps: collections -->

## Composition

<!-- steps: composition -->

## Class and binary instances

<!-- steps: instances -->

## Collection size and membership

Map, Set, `File`, and `Blob` outputs expose numeric `size`, so size validation is shared across them. Size-validation failures snapshot the single observed `size` value; the string and array emptiness and length validations keep their `length` payloads instead.

A Map or Set output therefore offers [`isEmpty()`](/api/primitives#isEmpty), [`isNotEmpty()`](/api/primitives#isNotEmpty), `isSizeAtLeast()`, `isSizeAtMost()`, `isSizeExactly()`, and [`toSize()`](/api/transforms#toSize). The first two live on [Primitives](/api/primitives) because they read a string or an array as readily as a collection.

Every membership form uses SameValueZero equality, so `NaN` matches `NaN` and `0` matches `-0`. Set membership reuses [`isIncluding()`](/api/primitives#isIncluding); Map membership is explicit about the searched domain.

<!-- steps: size-and-membership -->

```ts
const tags = v.set(v.string())
	.isNotEmpty()
	.isSizeAtMost(5)
	.isIncluding('required')

const scoreCount = v.map({ key: v.string(), value: v.number() })
	.isIncludingKey('primary')
	.isIncludingValue(1)
	.toSize()
```

## Media types

Matching a value's declared `type` is neither a size nor a membership check, so it sits on its own: it compares strings rather than values, and none of the equality rules above apply to it.

<!-- steps: media-type -->

## Related guidance

- [Structured Data](/guides-recipes/structured-data) — applied object and collection composition
- [Issues and Paths](/core-concepts/issues-and-paths) — nested paths and issue provenance
- [Valchecker 1.0 Contract](/reference/v1-contract#structural-composition-guarantees) — cross-cutting compatibility guarantees
