# Valchecker Documentation Site Plan

## Overview
Valchecker is a TypeScript schema validation library that follows the StandardSchemaV1 specification. It provides a type-safe way to validate and transform data with a fluent API.

## Target Audience
- TypeScript developers needing robust data validation
- Teams building APIs or handling user input
- Developers migrating from other validation libraries

## Site Structure

### 1. Introduction (`introduction.md`)
- What is Valchecker?
- Key features (type safety, StandardSchemaV1 compliance, fluent API, async support)
- Why choose Valchecker? (vs Zod, Yup, etc.)
- Quick example

### 2. Getting Started (`getting-started.md`)
- Installation (pnpm add valchecker)
- Basic usage example
- Import patterns

### 3. Core Concepts (`core-concepts.md`)
- Schemas and Types
- Execution and Results
- Success/Failure handling
- Async validation
- Type inference

### 4. API Reference
#### 4.1 Core API (`api-core.md`)
- `execute(schema, value)` - Execute validation
- `isValid(schema, value)` - Check validity
- `AbstractSchema` class
- Types: `ValSchema`, `ExecutionResult`, etc.

#### 4.2 Schema Constructors (`api-schemas.md`)
- Primitive schemas: `string()`, `number()`, `boolean()`, etc.
- Complex schemas: `object()`, `array()`, `union()`, etc.
- Special schemas: `literal()`, `optional()`, `never()`, etc.

#### 4.3 Pipe Operations (`api-pipe.md`)
- `check()` - Validation with custom logic
- `transform()` - Data transformation
- `fallback()` - Error recovery
- `run()` - Chaining schemas

### 5. Examples (`examples.md`)
- Basic validation examples
- Complex object validation
- Pipe operations (check, transform, fallback)
- Async validation
- Real-world use cases (user registration, API validation)

### 6. Advanced Topics (`advanced.md`)
- Custom schema creation
- Async validation patterns
- Error handling strategies
- Performance considerations
- Type narrowing with pipes

### 7. Migration Guide (`migration.md`) (if applicable)
- Migrating from other libraries

## Content Guidelines
- All content must be based on actual source code implementation
- Use code examples from `examples.test.ts` where possible
- Ensure type safety examples are accurate
- Document all exported functions and types
- Include both sync and async examples
- Show error handling patterns

## File Organization in .agents/
- `docs-plan.md` - This planning document
- `introduction.md`
- `getting-started.md`
- `core-concepts.md`
- `api-core.md`
- `api-schemas.md`
- `api-pipe.md`
- `examples.md`
- `advanced.md`
- `migration.md` (if needed)

## Next Steps
1. Prepare introduction.md
2. Prepare getting-started.md
3. Prepare core-concepts.md
4. Prepare API reference files
5. Prepare examples.md
6. Review and seek confirmation for uncertain parts