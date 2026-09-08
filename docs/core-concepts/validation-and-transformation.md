---
description: Distinguish constraints that preserve a successful value from transformations that change the pipeline output.
relatedSources:
  - packages/internal/src/core/types.ts
  - packages/internal/src/steps/string/string.ts
  - packages/internal/src/steps/check/check.ts
  - packages/internal/src/steps/transform/transform.ts
---
# Validation and Transformation

Validation and transformation are separate pipeline roles. A validation decides whether the current value may continue. A transformation produces a new successful value for everything that follows.

| Question | Validation | Transformation |
| --- | --- | --- |
| Primary purpose | accept or reject the current value | change the successful value or representation |
| Successful runtime value | preserved | replaced by the transformed output |
| Type-state effect | may narrow while keeping the same runtime value | updates the inferred output type |
| Generic escape hatch | `check()` | `transform()` |
| Built-in naming | usually `isXxx()` | usually `toXxx()` |

## Validation preserves the successful value

A validation can reject a value or narrow its type, but a successful validation does not silently normalize that value. If normalization is required, put an explicit transformation in the pipeline.

## Transformation changes what later steps receive

A transformation's output becomes the current successful value. Every later validation or transformation sees that new value, and `InferOutput` tracks the resulting type state.

The checked example below demonstrates both behaviors from one canonical source:

<<< ../.examples/core-concepts/validation-and-transformation/example.ts

The runtime test asserts that `validationResult` still contains `'  Alice  '`, while `transformationResult` contains `'Alice'`.

## Order communicates intent

```ts
import { v } from 'valchecker'

const normalizedThenChecked = v.string()
	.transform(value => value.trim())
	.check(value => value.length > 0)
```

Here the check receives the trimmed value. Reversing those two steps would validate the original string first and transform it only after the validation succeeds.

Use named built-in steps when they precisely express the operation. Use `check()` and `transform()` when the behavior is application-defined. Exact callback return forms, issue codes, and options belong to their generated Reference entries rather than this concept page.

## Async is a separate dimension

Validation versus transformation describes **what a step does to pipeline state**. Synchronous versus asynchronous describes **how execution completes**. Both `check()` and `transform()` may participate in a maybe-async pipeline when their callback reaches asynchronous work.

See [Synchronous and Asynchronous Execution](/core-concepts/sync-and-async) for that contract.
