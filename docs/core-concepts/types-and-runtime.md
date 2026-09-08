---
description: Understand how Valchecker type state describes input, output, issues, and completion mode without replacing runtime validation.
relatedSources:
  - packages/internal/src/core/core.ts
  - packages/internal/src/core/types.ts
  - packages/internal/src/steps/check/check.ts
  - packages/internal/src/steps/transform/transform.ts
---
# Types and Runtime Behavior

Valchecker carries a type-level execution context alongside the runtime pipeline. The types describe what the current schema means to TypeScript; runtime steps still decide whether an actual value succeeds.

| Question | Runtime view | Type-level view |
| --- | --- | --- |
| What enters the schema boundary? | an untrusted value is executed | `InferInput<Schema>` reads the recorded input state |
| What can a success contain now? | `result.value` | `InferOutput<Schema>` |
| What failures can this pipeline emit? | structured `issues` | `InferIssue<Schema>` |
| How can execution complete? | sync, maybe-async, or async executor | `InferOperationMode<Schema>` drives the `execute()` return type |

## Input and output are different questions

A normal public Valchecker instance starts with `input: unknown` and `output: unknown`. Initial schema steps validate that unknown boundary and refine the output state. Later transformations can replace the output type again.

That means `InferInput` is not a shortcut for "the object shape after validation." It is the schema's recorded boundary input type. `InferOutput` is the type of a successful value after the whole current pipeline.

```ts
import type { InferInput, InferOutput } from 'valchecker'
import { v } from 'valchecker'

const lengthSchema = v.string()
	.transform(value => value.length)

type Input = InferInput<typeof lengthSchema>
type Output = InferOutput<typeof lengthSchema>
```

For an ordinary schema created from the default initial instance, `Input` remains the unknown external boundary while `Output` follows the transformation to `number`.

## Each chained method returns a new type state

The core `Next<...>` type patches the current execution context. A validation may add issues or narrow output; a transformation replaces output with its callback result; an async-capable step updates operation mode.

Because chaining also creates a new runtime schema instance, the fluent value and its TypeScript type advance together without mutating the earlier schema.

## A successful type does not skip runtime work

`InferOutput<typeof schema>` describes what `result.value` can be **after success**. It does not assert that an arbitrary input already has that type, and it does not turn runtime validation into a compile-time cast.

Keep unknown external data unknown until the schema executes. Branch on the returned `ExecutionResult` before using the inferred output.

## Type mode can be more precise than runtime specialization

Callback steps such as `check()` and `transform()` can infer a precise TypeScript operation mode from their callback return type. The runtime cannot determine callback asynchrony from a function object at schema-construction time, so those steps conservatively register on the maybe-async executor path.

This is not a contradiction: the type state describes the public return contract TypeScript can prove, while the runtime mode chooses a safe execution strategy. See [Synchronous and Asynchronous Execution](/core-concepts/sync-and-async) for the observable completion behavior.

## Types complement Reference; they do not replace it

Type inference can tell you the current input, output, issue union, and completion shape. It does not encode every runtime edge case or option meaning. Exact built-in behavior still belongs to the generated [API Reference](/api/overview), while cross-cutting runtime semantics belong to these Core Concepts pages.
