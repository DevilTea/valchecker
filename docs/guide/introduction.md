# Introduction

## What is Valchecker?

Valchecker is a powerful, type-safe schema validation library for TypeScript that follows the [StandardSchemaV1](https://github.com/standard-schema/standard-schema) specification. It provides a fluent, composable API for validating and transforming data with full TypeScript inference.

## Key Features

- **Type Safety**: Full TypeScript support with automatic type inference
- **StandardSchemaV1 Compliant**: Compatible with the emerging standard for schema validation
- **Fluent API**: Chain operations like `check()`, `transform()`, and `fallback()`
- **Async Support**: Built-in support for asynchronous validation and transformation
- **Composable**: Build complex schemas from simple primitives
- **Lightweight**: Minimal dependencies, focused on validation

## Why Valchecker?

Valchecker stands out from other validation libraries by combining:

- **Standard Compliance**: Works seamlessly with tools that support StandardSchemaV1
- **Type-First Design**: Types are derived directly from your schema definitions
- **Flexible Pipelines**: Transform data during validation with pipe operations
- **Error Recovery**: Use `fallback()` to provide default values on validation failure
- **Async by Default**: All operations support both sync and async patterns

## Quick Example

```typescript
import * as v from 'valchecker'

// Define a schema
const userSchema = v.object({
	name: v.string(),
	age: v.number(),
	email: v.pipe(v.string())
		.check(email => email.includes('@'), 'Invalid email format')
		.transform(email => email.toLowerCase())
})

// Validate data
const result = v.execute(userSchema, {
	name: 'John Doe',
	age: 30,
	email: 'JOHN@EXAMPLE.COM'
})

if (v.isSuccess(result)) {
	console.log(result.value)
	// { name: 'John Doe', age: 30, email: 'john@example.com' }
}
else {
	console.log('Validation failed:', result.issues)
}
```

This example demonstrates:
- Object schema composition
- String validation with custom checks
- Data transformation during validation
- Type-safe result handling

## Philosophy

Valchecker is designed with these principles:

1. **Type Safety First**: Every schema produces accurate TypeScript types
2. **Composability**: Build complex validations from simple, reusable parts
3. **Standards Compliance**: Follow industry standards for interoperability
4. **Developer Experience**: Intuitive API with helpful error messages
5. **Performance**: Efficient validation with minimal overhead

## Next Steps

- [Getting Started](./getting-started.md) - Installation and basic usage
- [Core Concepts](./core-concepts.md) - Understanding schemas and execution
- [API Reference](../api/core.md) - Complete API documentation
- [Examples](./examples.md) - Real-world usage patterns
