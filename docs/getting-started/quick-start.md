---
description: Install Valchecker, build a first schema, execute it, and understand the success or failure result.
relatedSources:
  - packages/internal/src/core/core.ts
  - packages/internal/src/steps/object/object.ts
  - packages/internal/src/steps/string/string.ts
  - packages/internal/src/steps/toTrimmed/toTrimmed.ts
  - packages/internal/src/steps/looseNumber/looseNumber.ts
---
# Quick Start

Valchecker builds schemas as ordered pipelines. Start with the default `v` instance, describe the input you expect, then execute the schema against unknown data.

## Install Valchecker

```bash
pnpm add valchecker
# or
npm install valchecker
```

Import the default instance when bundle-level step selection is not yet a concern:

```ts
import { v } from 'valchecker'
```

The default instance exposes every built-in step. Selective instances are an advanced optimization covered under [Extending Valchecker](/extending/custom-step-plugins).

## Build a schema

This example validates an object and normalizes two fields. The exact runtime behavior is checked from the same source file rendered below.

<<< ../.examples/getting-started/first-schema/example.ts

The chain is read from left to right. `string()` and `looseNumber()` establish the accepted runtime domains; `toTrimmed()` changes the successful `name` value before the enclosing object produces its output.

For exact options and issue contracts of individual steps, use the generated [API Reference](/api/overview) rather than treating this page as a second API catalog.

## Execute the schema

`userSchema.execute(userInput)` runs the pipeline and returns either a success result with `value` or a failure result with one or more structured `issues`.

For the checked example above, the successful result is:

```ts
const expectedResult = {
	value: {
		name: 'Alice',
		age: 25,
	},
}
```

This schema is fully synchronous, so that result is returned directly. Pipelines that reach asynchronous work may return a promise instead; [Synchronous and Asynchronous Execution](/core-concepts/sync-and-async) explains that contract.

## Read the result

A success contains the final transformed value. A failure contains structured issues rather than throwing for an ordinary validation failure.

Use `v.isSuccess(result)` or `v.isFailure(result)` when branching on the result. Issue codes are for programmatic identity, while `path` identifies the failing data location. See [Issues and Paths](/core-concepts/issues-and-paths) for the mental model.

## Where to go next

- [Pipeline and Chaining](/core-concepts/pipeline-and-chaining) — how schemas accumulate ordered steps without mutating earlier schemas.
- [Validation and Transformation](/core-concepts/validation-and-transformation) — why constraints and output changes are separate operations.
- [Synchronous and Asynchronous Execution](/core-concepts/sync-and-async) — when `execute()` returns directly or returns a promise.
- [Issues and Paths](/core-concepts/issues-and-paths) — structured failures, data paths, and branch context.
- [Types and Runtime Behavior](/core-concepts/types-and-runtime) — how `InferInput`, `InferOutput`, issues, and execution mode track a schema.
- [API Reference](/api/overview) — exact built-in step contracts.
