# Schema Constructors API Reference

This section documents all built-in schema constructors provided by valchecker.

## Primitive Schemas

### `string(options?)`

Creates a schema that validates string values.

```typescript
function string(options?: { message?: string }): ValSchema
```

**Input:** `unknown`  
**Output:** `string`  
**Issues:** `'EXPECTED_STRING'`

**Example:**
```typescript
const schema = v.string()
v.execute(schema, 'hello') // Success: { value: 'hello' }
v.execute(schema, 123)     // Failure: EXPECTED_STRING
```

### `number(allowNaN?)`

Creates a schema that validates number values.

```typescript
function number(allowNaN?: boolean): ValSchema
```

**Parameters:**
- `allowNaN`: Whether to allow `NaN` values (default: `false`)

**Input:** `unknown`  
**Output:** `number`  
**Issues:** `'EXPECTED_NUMBER'`, `'EXPECTED_FINITE_NUMBER'`

**Example:**
```typescript
const schema = v.number()
v.execute(schema, 42)      // Success: { value: 42 }
v.execute(schema, '42')    // Failure: EXPECTED_NUMBER
v.execute(schema, NaN)     // Failure: EXPECTED_FINITE_NUMBER (unless allowNaN=true)
```

### `boolean()`

Creates a schema that validates boolean values.

```typescript
function boolean(): ValSchema
```

**Input:** `unknown`  
**Output:** `boolean`  
**Issues:** `'EXPECTED_BOOLEAN'`

**Example:**
```typescript
const schema = v.boolean()
v.execute(schema, true)    // Success: { value: true }
v.execute(schema, 'true')  // Failure: EXPECTED_BOOLEAN
```

### `bigint()`

Creates a schema that validates bigint values.

```typescript
function bigint(): ValSchema
```

**Input:** `unknown`  
**Output:** `bigint`  
**Issues:** `'EXPECTED_BIGINT'`

### `symbol()`

Creates a schema that validates symbol values.

```typescript
function symbol(): ValSchema
```

**Input:** `unknown`  
**Output:** `symbol`  
**Issues:** `'EXPECTED_SYMBOL'`

## Literal and Special Values

### `literal(value)`

Creates a schema that only accepts a specific literal value.

```typescript
function literal<T>(value: T): ValSchema
```

**Input:** `unknown`  
**Output:** `T`  
**Issues:** `'EXPECTED_LITERAL'`

**Example:**
```typescript
const schema = v.literal('active')
v.execute(schema, 'active')  // Success: { value: 'active' }
v.execute(schema, 'pending') // Failure: EXPECTED_LITERAL
```

### `null()`

Creates a schema that only accepts `null`.

```typescript
function null(): ValSchema
```

**Input:** `unknown`  
**Output:** `null`  
**Issues:** `'EXPECTED_NULL'`

### `undefined()`

Creates a schema that only accepts `undefined`.

```typescript
function undefined(): ValSchema
```

**Input:** `unknown`  
**Output:** `undefined`  
**Issues:** `'EXPECTED_UNDEFINED'`

### `never()`

Creates a schema that never validates (always fails).

```typescript
function never(): ValSchema
```

**Input:** `unknown`  
**Output:** `never`  
**Issues:** `'EXPECTED_NEVER'`

## Complex Schemas

### `object(shape)`

Creates a schema that validates objects with the specified shape.

```typescript
function object<T extends Record<string, ValSchema>>(shape: T): ValSchema
```

**Input:** `unknown`  
**Output:** Object with properties matching the shape  
**Issues:** `'EXPECTED_OBJECT'`, `'MISSING_PROPERTY'`, `'UNEXPECTED_PROPERTY'`

**Example:**
```typescript
const schema = v.object({
  name: v.string(),
  age: v.number()
})

v.execute(schema, { name: 'John', age: 30 })
// Success: { value: { name: 'John', age: 30 } }
```

### `array(itemSchema)`

Creates a schema that validates arrays where each item matches the provided schema.

```typescript
function array<T extends ValSchema>(itemSchema: T): ValSchema
```

**Input:** `unknown`  
**Output:** `Array<InferOutput<T>>`  
**Issues:** `'EXPECTED_ARRAY'`

**Example:**
```typescript
const schema = v.array(v.string())
v.execute(schema, ['a', 'b', 'c'])  // Success
v.execute(schema, [1, 2, 3])       // Failure: items are not strings
```

### `union(...schemas)`

Creates a schema that validates against any of the provided schemas.

```typescript
function union<T extends readonly [ValSchema, ...ValSchema[]]>(...schemas: T): ValSchema
```

**Input:** `unknown`  
**Output:** Union of all schema outputs  
**Issues:** `'EXPECTED_UNION'`

**Example:**
```typescript
const schema = v.union(v.string(), v.number())
v.execute(schema, 'hello')  // Success: string
v.execute(schema, 42)       // Success: number
v.execute(schema, true)     // Failure: neither string nor number
```

### `intersection(...schemas)`

Creates a schema that validates against all of the provided schemas simultaneously.

```typescript
function intersection<T extends readonly [ValSchema, ...ValSchema[]]>(...schemas: T): ValSchema
```

**Input:** `unknown`  
**Output:** Intersection of all schema outputs  
**Issues:** `'EXPECTED_INTERSECTION'`

## Modifiers

### `optional(schema)`

Creates a schema that makes the input schema optional (allows `undefined`).

```typescript
function optional<T extends ValSchema>(schema: T): ValSchema
```

**Input:** `unknown`  
**Output:** `InferOutput<T> | undefined`  
**Issues:** Same as wrapped schema

**Example:**
```typescript
const schema = v.optional(v.string())
v.execute(schema, 'hello')  // Success: 'hello'
v.execute(schema, undefined) // Success: undefined
v.execute(schema, 123)      // Failure: EXPECTED_STRING
```

## Advanced Schemas

### `instance(constructor)`

Creates a schema that validates instances of a specific class.

```typescript
function instance<T extends new (...args: any[]) => any>(constructor: T): ValSchema
```

**Input:** `unknown`  
**Output:** `InstanceType<T>`  
**Issues:** `'EXPECTED_INSTANCE'`

**Example:**
```typescript
class User {}
const schema = v.instance(User)
v.execute(schema, new User())  // Success
v.execute(schema, {})          // Failure
```

### `lazy(factory)`

Creates a schema that defers creation until execution (useful for recursive schemas).

```typescript
function lazy<T extends ValSchema>(factory: () => T): ValSchema
```

**Input:** Same as factory schema  
**Output:** Same as factory schema  
**Issues:** Same as factory schema

**Example:**
```typescript
type Node = { value: number; children?: Node[] }
const nodeSchema: v.ValSchema<Node> = v.object({
  value: v.number(),
  children: v.optional(v.array(v.lazy(() => nodeSchema)))
})
```

### `pipe(baseSchema)`

Creates a pipe schema for chaining validation operations.

```typescript
function pipe<T extends ValSchema>(baseSchema: T): PipeSchema<T>
```

See [Pipe Operations](./api-pipe.md) for detailed documentation.

### `unknown()`

Creates a schema that accepts any value (always succeeds).

```typescript
function unknown(): ValSchema
```

**Input:** `unknown`  
**Output:** `unknown`  
**Issues:** None (always succeeds)

## Error Codes

Common error codes used by built-in schemas:

- `'EXPECTED_STRING'`
- `'EXPECTED_NUMBER'`
- `'EXPECTED_BOOLEAN'`
- `'EXPECTED_BIGINT'`
- `'EXPECTED_SYMBOL'`
- `'EXPECTED_LITERAL'`
- `'EXPECTED_NULL'`
- `'EXPECTED_UNDEFINED'`
- `'EXPECTED_NEVER'`
- `'EXPECTED_OBJECT'`
- `'EXPECTED_ARRAY'`
- `'EXPECTED_UNION'`
- `'EXPECTED_INTERSECTION'`
- `'EXPECTED_INSTANCE'`
- `'MISSING_PROPERTY'`
- `'UNEXPECTED_PROPERTY'`
- `'EXPECTED_FINITE_NUMBER'`

## Next Section

- [Pipe Operations](./api-pipe.md) - Advanced validation with pipes
- [Examples](./examples.md) - Usage examples for all schemas