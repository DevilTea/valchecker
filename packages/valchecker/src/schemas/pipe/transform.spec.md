# PipeStepTransformSchema

PipeStepTransformSchema is a pipeline step schema that applies a transformation function to the validated value from the previous step.

## Overview

PipeStepTransformSchema is used in validation pipelines to transform the output of one validation step before passing it to the next step. It only executes when the previous step succeeds and applies the provided transformation function to the validated value.

## API

### Constructor

#### `new PipeStepTransformSchema({ meta: { transform }, message? })`

Creates a new transform schema instance.

**Parameters:**
- `meta.transform`: The transformation function to apply
- `message`: Optional custom error message for transform failures

### Types

#### `RunTransform<Input = any>`

A function that takes an input value and returns a transformed value.

```typescript
type RunTransform<Input = any> = (value: Input) => any
```

#### `PipeStepTransformSchemaMessage<Fn>`

The message type for transform schema errors.

## Behavior

### Success Path

When the previous step succeeds:
1. Extracts the validated value from `lastResult.value`
2. Applies the transform function to the value
3. Returns a success result with the transformed value

### Failure Path

When the previous step fails:
1. Returns the failure result unchanged (passes it through)
2. Does not execute the transform function

### Error Handling

When the transform function throws an error:
1. Catches the error
2. Returns a failure result with code 'TRANSFORM_FAILED'
3. Includes the original error in the issue details

## Usage in Pipelines

PipeStepTransformSchema is typically used through the `transform` method on schemas or PipeSchema:

```typescript
const pipeline = schema.transform(value => value.toUpperCase())
```

## Examples

### Basic Transformation

```typescript
const transformStep = new PipeStepTransformSchema({
	meta: {
		transform: (value: string) => value.toUpperCase()
	}
})
```

### Async Transformation

```typescript
const asyncTransformStep = new PipeStepTransformSchema({
	meta: {
		transform: async (value: string) => {
			const result = await someAsyncOperation(value)
			return result
		}
	}
})
```

### Error Handling

```typescript
const failingTransform = new PipeStepTransformSchema({
	meta: {
		transform: (value: string) => {
			if (value.length === 0) {
				throw new Error('Empty string not allowed')
			}
			return value
		}
	}
})
```

## Type Safety

The schema is fully type-safe:
- Input type is inferred from the transform function parameter
- Output type is inferred from the transform function return type
- Async behavior is automatically detected from the transform function

## Integration

PipeStepTransformSchema integrates seamlessly with the pipeline system:
- Works with both sync and async transform functions
- Properly handles ExecutionResult types from previous steps
- Can be chained with other pipeline steps
- Maintains type safety throughout the pipeline
