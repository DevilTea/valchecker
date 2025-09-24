# Advanced Topics

This section covers advanced patterns and concepts for using valchecker effectively in complex scenarios.

## Custom Schema Creation

Creating custom schemas in valchecker follows a structured pattern used throughout the codebase. Here are the steps:

### Step 1: Define Schema Types

Use `DefineSchemaTypes` to define the schema's type-level behavior:

```typescript
import type { DefineSchemaTypes } from 'valchecker'

type CustomStringSchemaTypes = DefineSchemaTypes<{
  Meta: { prefix?: string }  // Optional metadata
  Output: string             // Output type
  IssueCode: 'EXPECTED_CUSTOM_STRING'  // Error code type
}>
```

### Step 2: Define Message Type (Optional)

If you need custom error messages, define the message type:

```typescript
import type { SchemaMessage } from 'valchecker'

type CustomStringSchemaMessage = SchemaMessage<CustomStringSchemaTypes>
```

### Step 3: Define Schema Class

Create a class that extends `AbstractSchema` with the defined types:

```typescript
import { AbstractSchema } from 'valchecker'

class CustomStringSchema extends AbstractSchema<CustomStringSchemaTypes> {}
```

### Step 4: Implement Schema Behavior

Call `implementSchemaClass` to provide the implementation:

```typescript
import { implementSchemaClass } from 'valchecker'

implementSchemaClass(CustomStringSchema, {
  defaultMessage: {
    EXPECTED_CUSTOM_STRING: 'Expected a custom string.',
  },
  execute: (value, { meta, success, failure }) => {
    const prefix = meta.prefix || 'custom_'
    if (typeof value === 'string' && value.startsWith(prefix)) {
      return success(value)
    }
    return failure('EXPECTED_CUSTOM_STRING')
  },
})
```

### Step 5: Create Constructor Function

Create a function that instantiates the schema:

```typescript
function customString(options?: { prefix?: string; message?: CustomStringSchemaMessage }): CustomStringSchema {
  return new CustomStringSchema({
    meta: { prefix: options?.prefix },
    message: options?.message,
  })
}
```

### Complete Example

Here's a complete custom schema example:

```typescript
import type { DefineSchemaTypes, SchemaMessage } from 'valchecker'
import { AbstractSchema, implementSchemaClass } from 'valchecker'

type PositiveNumberSchemaTypes = DefineSchemaTypes<{
  Output: number
  IssueCode: 'EXPECTED_POSITIVE_NUMBER'
}>

type PositiveNumberSchemaMessage = SchemaMessage<PositiveNumberSchemaTypes>

class PositiveNumberSchema extends AbstractSchema<PositiveNumberSchemaTypes> {}

implementSchemaClass(PositiveNumberSchema, {
  defaultMessage: {
    EXPECTED_POSITIVE_NUMBER: 'Expected a positive number.',
  },
  execute: (value, { success, failure }) => {
    if (typeof value === 'number' && value > 0 && !Number.isNaN(value)) {
      return success(value)
    }
    return failure('EXPECTED_POSITIVE_NUMBER')
  },
})

function positiveNumber(message?: PositiveNumberSchemaMessage): PositiveNumberSchema {
  return new PositiveNumberSchema({ message })
}

// Usage
const schema = positiveNumber()
v.execute(schema, 5)    // Success
v.execute(schema, -1)   // Failure
```

This pattern is used consistently across all built-in schemas in valchecker, ensuring type safety and consistent behavior.

## Async Validation Patterns

### Async Schema Composition

When combining async and sync schemas, the result is always async:

```typescript
const mixedSchema = v.object({
  syncField: v.string(),
  asyncField: v.pipe(v.string()).check(async value => {
    await someAsyncCheck(value)
    return true
  })
})

// Result is always Promise<ExecutionResult>
const result = await v.execute(mixedSchema, data)
```

### Async Fallbacks

Use async fallbacks for complex error recovery:

```typescript
const databaseSchema = v.pipe(v.string())
  .check(async id => {
    const exists = await checkIdExists(id)
    return exists
  }, 'ID does not exist')
  .fallback(async issues => {
    // Log error and create new ID
    await logValidationError(issues)
    return await generateNewId()
  })
```

## Error Handling Strategies

### Centralized Error Handling

Create wrapper functions for consistent error handling:

```typescript
function validateOrThrow<T>(schema: ValSchema<any, T>, value: unknown): T {
  const result = v.execute(schema, value)
  if (v.isSuccess(result)) {
    return result.value
  }

  const error = new ValidationError('Validation failed', result.issues)
  error.issues = result.issues
  throw error
}

class ValidationError extends Error {
  issues: ExecutionIssue[]

  constructor(message: string, issues: ExecutionIssue[]) {
    super(message)
    this.issues = issues
  }
}
```

### Path-Based Error Mapping

Handle nested validation errors with path information:

```typescript
function formatValidationErrors(issues: ExecutionIssue[]): string[] {
  return issues.map(issue => {
    const path = issue.path ? issue.path.join('.') : 'root'
    return `${path}: ${issue.message}`
  })
}

const userSchema = v.object({
  profile: v.object({
    name: v.string(),
    settings: v.object({
      theme: v.union(v.literal('light'), v.literal('dark'))
    })
  })
})

const result = v.execute(userSchema, invalidData)
if (!v.isSuccess(result)) {
  const errors = formatValidationErrors(result.issues)
  // Output: ["profile.settings.theme: Expected union value"]
}
```

## Performance Considerations

### Schema Reuse

Reuse schema instances instead of creating them repeatedly:

```typescript
// Good: Create once, reuse
const userSchema = v.object({
  name: v.string(),
  email: v.string(),
})

function validateUsers(users: unknown[]) {
  return users.map(user => v.execute(userSchema, user))
}

// Bad: Creates new schema each time
function validateUserBad(user: unknown) {
  const schema = v.object({ name: v.string(), email: v.string() })
  return v.execute(schema, user)
}
```

### Lazy Evaluation

Use lazy schemas for recursive structures to avoid infinite recursion:

```typescript
type TreeNode = {
  value: string
  children?: TreeNode[]
}

const treeSchema: v.ValSchema<TreeNode> = v.object({
  value: v.string(),
  children: v.optional(v.array(v.lazy(() => treeSchema)))
})
```

### Pipe Optimization

Order pipe operations for efficiency - put cheap checks first:

```typescript
// Good: Fast checks first
const optimizedSchema = v.pipe(v.string())
  .check(value => value.length > 0, 'Cannot be empty')  // Fast
  .check(value => value.length <= 100, 'Too long')     // Fast
  .check(async value => await expensiveCheck(value))   // Slow

// Bad: Expensive check runs even for empty strings
const suboptimalSchema = v.pipe(v.string())
  .check(async value => await expensiveCheck(value))   // Runs first
  .check(value => value.length > 0, 'Cannot be empty')
```

## Type Narrowing Advanced Patterns

### Complex Type Guards

Use type guards with pipe checks for sophisticated narrowing:

```typescript
type UserRole = 'admin' | 'user' | 'guest'
type User = {
  id: number
  role: UserRole
  permissions: string[]
}

const userSchema = v.pipe(v.object({
  id: v.number(),
  role: v.union(v.literal('admin'), v.literal('user'), v.literal('guest')),
  permissions: v.array(v.string())
}))
  .check((user): user is User => {
    // Complex validation logic
    if (user.role === 'admin') {
      return user.permissions.includes('manage_users')
    }
    if (user.role === 'user') {
      return !user.permissions.includes('manage_users')
    }
    // guest has no permissions
    return user.permissions.length === 0
  }, 'Invalid permission combination for role')
```

### Narrowing with Transform

Combine narrowing checks with transformations:

```typescript
const parsedNumberSchema = v.pipe(v.string())
  .check((value, { narrow }) => {
    const num = Number(value)
    if (!isNaN(num)) {
      narrow<`${number}`>()  // Narrow to string that represents a number
      return true
    }
    return false
  }, 'Must be a valid number string')
  .transform(value => Number(value))  // Now safe to convert
```

## Schema Composition Patterns

### Conditional Schemas

Create schemas that change behavior based on input:

```typescript
function createConditionalSchema(type: string) {
  const baseSchema = v.object({
    type: v.literal(type),
    data: v.unknown()
  })

  if (type === 'user') {
    return v.pipe(baseSchema)
      .check(obj => typeof obj.data === 'object' && obj.data !== null)
      .transform(obj => ({
        ...obj,
        data: v.execute(v.object({ name: v.string(), age: v.number() }), obj.data)
      }))
  }

  return baseSchema
}
```

### Schema Factories

Create reusable schema factories:

```typescript
function createPaginatedResponseSchema<T extends ValSchema>(itemSchema: T) {
  return v.object({
    items: v.array(itemSchema),
    total: v.number(),
    page: v.number(),
    pageSize: v.number(),
    hasNext: v.boolean(),
  })
}

const userListSchema = createPaginatedResponseSchema(v.object({
  id: v.number(),
  name: v.string(),
}))
```

## Integration Patterns

### Express.js Middleware

```typescript
import express from 'express'
import * as v from 'valchecker'

const app = express()
app.use(express.json())

function validateBody(schema: ValSchema) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const result = v.execute(schema, req.body)
    if (v.isSuccess(result)) {
      req.body = result.value // Type-safe body
      next()
    } else {
      res.status(400).json({
        error: 'Validation failed',
        issues: result.issues
      })
    }
  }
}

const createUserSchema = v.object({
  name: v.string(),
  email: v.string(),
})

app.post('/users', validateBody(createUserSchema), (req, res) => {
  // req.body is now typed as { name: string; email: string }
  const user = createUser(req.body)
  res.json(user)
})
```

### Database Integration

```typescript
class ValidatedDatabase {
  async insert(table: string, schema: ValSchema, data: unknown) {
    const result = v.execute(schema, data)
    if (!v.isSuccess(result)) {
      throw new ValidationError('Invalid data', result.issues)
    }

    return await this.db.insert(table, result.value)
  }

  async update(table: string, schema: ValSchema, id: string, data: unknown) {
    const result = v.execute(schema, data)
    if (!v.isSuccess(result)) {
      throw new ValidationError('Invalid data', result.issues)
    }

    return await this.db.update(table, id, result.value)
  }
}
```

## Best Practices

1. **Keep schemas simple**: Break complex schemas into smaller, reusable pieces
2. **Use TypeScript**: Leverage type inference for better development experience
3. **Handle errors gracefully**: Provide meaningful error messages
4. **Test thoroughly**: Include both positive and negative test cases
5. **Document schemas**: Use comments to explain complex validation logic
6. **Reuse schemas**: Create schema libraries for common patterns

## Troubleshooting

### Common Issues

**Schema not inferring types correctly:**
- Ensure all schema constructors are properly typed
- Check for any `any` types that might break inference

**Async schemas causing type errors:**
- Make sure all parts of the pipeline are properly typed for async
- Use `Promise.all` for parallel async operations

**Performance problems:**
- Profile your validation code
- Consider caching expensive validations
- Use simpler schemas for hot paths

**Please confirm the custom schema creation section** - I need verification that the `implementSchemaClass` usage is correct and complete.