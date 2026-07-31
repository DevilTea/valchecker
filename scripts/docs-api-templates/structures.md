# Structures

Structural validators compose nested schemas and prepend property keys or collection indexes to child issue paths without mutating child issues.

The normative edge-case behavior is defined in the [Valchecker 1.0 Contract](/guide/v1-contract#object-schemas).

<!-- typecheck-prelude
declare const createValchecker: typeof import('valchecker').createValchecker
declare const union: typeof import('valchecker').union
declare const literal: typeof import('valchecker').literal
declare const null_: typeof import('valchecker').null_
declare const undefined_: typeof import('valchecker').undefined_
declare const number: typeof import('valchecker').number
declare const isGreaterThan: typeof import('valchecker').isGreaterThan
-->

## Issue collection

`object()`, `strictObject()`, `looseObject()`, `array()`, `tuple()`, `set()`, `map()`, `record()`, and `intersection()` stop after the first recoverable structural or child failure by default. A failing child can still contribute every issue produced by that child execution; later sibling fields, items, entries, or intersection branches are not evaluated.

Set `collectAllIssues: true` on the structural step to continue after recoverable failures:

```ts
const form = v.object({
	name: v.string(),
	age: v.number(),
}, { collectAllIssues: true })
```

Internal issues are always fatal and stop later structural work in both modes. The option is resolved when the schema is constructed, so the hot traversal loop does not repeatedly branch on it.

`collectAllIssues` does not apply to `union()` or `variant()`, which select a branch rather than traversing siblings.

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

## Nested issue paths

```ts
const schema = v.object({
	users: v.array(
		v.object({
			profile: v.object({
				name: v.string(),
			}),
		}),
	),
})
```

A failure in the second user's name receives path `['users', 1, 'profile', 'name']`. Symbols remain symbol path segments. Frozen or reused child issues are supported because path prepending clones rather than mutates.
