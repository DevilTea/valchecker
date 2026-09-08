---
description: Compose object, collection, optional-field, and union schemas without turning application guides into an API catalog.
relatedSources:
  - packages/internal/src/steps/object/object.ts
  - packages/internal/src/steps/strictObject/strictObject.ts
  - packages/internal/src/steps/looseObject/looseObject.ts
  - packages/internal/src/steps/array/array.ts
  - packages/internal/src/steps/union/union.ts
---
# Structured Data

Real inputs are usually objects containing optional fields, collections, and variant values. Build those schemas from small child pipelines, then let the structural step compose their outputs and issues.

## Start from the output you need

The checked example below accepts an order-like object, normalizes nested strings and a loose numeric quantity, preserves the declared optional `note` property, and constrains `status` to two branches.

<<< ../.examples/guides-recipes/structured-data/example.ts

Its runtime test locks the resulting value, including `note: undefined` when that declared optional property is absent.

## Choose the structural boundary deliberately

| Need | Structural tool | Reader-level intent |
| --- | --- | --- |
| Produce only the declared shape | [`object()`](/api/structures#object) | Parse a known object contract and omit unrelated input properties from the output. |
| Reject unexpected own enumerable keys | [`strictObject()`](/api/structures#strictobject) | Treat extra keys as invalid input. |
| Preserve unknown own properties | [`looseObject()`](/api/structures#looseobject) | Validate known fields while carrying unrelated properties through. |
| Validate repeated items | [`array()`](/api/structures#array) | Apply one child schema to each array item. |
| Accept one of several schema shapes | [`union()`](/api/structures#union) | Try declared branches in order and return the first successful branch output. |

Those links own the exact unknown-key, issue, and parameter contracts. The application decision is which boundary matches the data you intend to expose downstream.

## Compose field pipelines before the object

Keep normalization and validation close to the field they describe:

```ts
import { v } from 'valchecker'

const profileSchema = v.object({
	displayName: v.string()
		.toTrimmed()
		.isNotEmpty(),
	tags: v.array(v.string()
		.toLowercase())
		.isLengthAtMost(10),
})
```

The outer object composes those finished child pipelines. It should not become a second place to restate every string or array rule.

## Use optional fields for absence, not invalid values

A one-element tuple marks an object property as optional:

```ts
const accountSchema = v.object({
	id: v.string(),
	nickname: [v.string()
		.toTrimmed()],
})
```

That means the property may be absent. It does not make an invalid present value valid. If `nickname` exists, its child schema still runs normally.

Use [Fallback and Recovery](/guides-recipes/fallback-and-recovery) when the requirement is instead to replace a recoverable failure with an intentional value.

## Model variants with schemas, not post-parse switches

A union is useful when each variant has a distinct validated shape:

```ts
const eventSchema = v.union([
	v.object({
		type: v.literal('click'),
		x: v.number()
			.isFinite(),
		y: v.number()
			.isFinite(),
	}),
	v.object({
		type: v.literal('keypress'),
		key: v.string()
			.isNotEmpty(),
	}),
])
```

When a union fails, branch provenance is context rather than data location. See [Issues and Paths](/core-concepts/issues-and-paths) for that distinction.

## Keep leaf details in Reference

A guide should explain composition decisions, not enumerate every primitive constraint. Use the generated [API Reference](/api/overview) for exact built-in step contracts, and [Types and Runtime Behavior](/core-concepts/types-and-runtime) when the question is how the composed schema affects inferred input/output types.
