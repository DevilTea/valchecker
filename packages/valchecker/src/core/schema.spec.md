# AbstractSchema

AbstractSchema is an abstract base class that extends AbstractBaseSchema and provides chainable pipe methods for creating validation pipelines.

## Overview

AbstractSchema serves as the foundation for all schema classes in the valchecker library. It extends AbstractBaseSchema with additional methods that allow schemas to be chained together in pipelines using the `check`, `transform`, and `fallback` methods.

## API

### Methods

#### `check<Check>(check, message?)`

Adds a check step to the schema pipeline.

**Parameters:**
- `check`: A function that performs validation on the schema's output
- `message`: Optional custom error message for check failures

**Returns:** A PipeSchema instance with the check step added

**Example:**
```typescript
const schema = new MySchema()
const pipeline = schema.check(value => value > 0, 'Value must be positive')
```

#### `transform<Transform>(transform, message?)`

Adds a transform step to the schema pipeline.

**Parameters:**
- `transform`: A function that transforms the schema's output
- `message`: Optional custom error message for transform failures

**Returns:** A PipeSchema instance with the transform step added

**Example:**
```typescript
const schema = new MySchema()
const pipeline = schema.transform(value => value.toString())
```

#### `fallback<Fallback>(fallback, message?)`

Adds a fallback step to the schema pipeline.

**Parameters:**
- `fallback`: A value or function to use as fallback when validation fails
- `message`: Optional custom error message for fallback failures

**Returns:** A PipeSchema instance with the fallback step added

**Example:**
```typescript
const schema = new MySchema()
const pipeline = schema.fallback('default value')
```

## Usage

AbstractSchema is designed to be extended by concrete schema implementations:

```typescript
class MyStringSchema extends AbstractSchema<{
	async: false
	transformed: false
	meta: null
	input: string
	output: string
	issueCode: 'INVALID_STRING'
}> {
	// Implementation
}
```

## Inheritance

AbstractSchema extends AbstractBaseSchema and inherits all its properties and methods, including:
- `validate()` method for running validation
- `isValid()` method for checking validity
- `isTransformed` property
- `meta` property

## Pipeline Integration

The chainable methods (`check`, `transform`, `fallback`) create PipeSchema instances that can be further chained:

```typescript
const pipeline = schema
	.check(value => value.length > 0)
	.transform(value => value.toUpperCase())
	.fallback('N/A')
```

This creates a validation pipeline that:
1. Validates the input using the base schema
2. Checks that the result has length > 0
3. Transforms the result to uppercase
4. Falls back to 'N/A' if any step fails
