# Type Inference

Valchecker tracks input, successful output, issue union, registered fluent methods, and operation mode through every step.

## Input and output

```ts
import type { InferInput, InferOutput } from '@valchecker/internal'

const schema = v.object({
	name: v.string().toTrimmed().isNotEmpty(),
	count: v.looseNumber().isFinite().isInteger(),
})

type Input = InferInput<typeof schema>
type Output = InferOutput<typeof schema>
```

Strict primitive and loose-primitive schemas output the primitive. Supported loose string representations are normalized and do not remain in the output union.

## Optional object fields

A one-element tuple marks a field optional:

```ts
const user = v.object({
	name: v.string(),
	nickname: [v.string()],
})
```

The input property may be absent. The declared output property is materialized with `undefined` when absent.

## Transformations

Concrete and generic transformations replace the successful output type:

```ts
const count = v.string()
	.toSplit(',')
	.toFiltered(value => value.length > 0)
	.toLength()

type CountInput = InferInput<typeof count> // string
type CountOutput = InferOutput<typeof count> // number
```

Built-in validations preserve the output type unless a type-guard `check()` or `utils.narrow()` establishes a narrower subtype.

## JSON assertions versus validation

```ts
const asserted = v.string().toJSONValue<{ name: string }>()
```

The type argument asserts the parsed output; it does not validate the structure. Delegate to a schema for runtime proof:

```ts
const validated = v.string()
	.toJSONValue()
	.use(v.object({ name: v.string() }))
```

`as<T>()` is likewise type-only and performs no runtime validation or transformation.

## Structures and composition

- object-family output follows declared fields, optional markers, transforms, and extra-key policy;
- arrays, tuples, Sets, Maps, and records use transformed child outputs;
- union output is the union of branch outputs and returns the first successful branch;
- variant output is the union of configured selected branches;
- intersection output follows the compatible composed branch outputs;
- `use()` preserves the delegated schema's output and issue types;
- `generic()` supplies lazy/recursive state declared by its type argument.

## Async mode

Async work changes execution mode rather than successful output. A maybe-async schema may still return a direct earlier failure before reaching a callback. `.toAsync()` changes the contract so every execution returns a native promise.

## Guidance

- infer reusable schemas instead of duplicating interfaces;
- use `check()` type-guard overloads only when runtime work proves the narrower type;
- treat `toJSONValue<T>()` and `as<T>()` as assertions;
- keep transformations explicit so the input/output transition remains reviewable;
- use the exported result guards rather than ad hoc casts.
