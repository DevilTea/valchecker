# Complete Step Reference

Comprehensive documentation of all available validation steps.

## Primitive Types

### string

Validate string values.

```typescript
v.string()

// Examples
v.string().execute('hello')      // { value: 'hello' }
v.string().execute(123)          // { issues: [{code: 'string:expected_string', ...}] }
```

### number

Validate numeric values.

```typescript
v.number()

// Examples
v.number().execute(42)           // { value: 42 }
v.number().execute('42')         // { issues: [...] }
```

### boolean

Validate boolean values.

```typescript
v.boolean()

// Examples
v.boolean().execute(true)        // { value: true }
v.boolean().execute('true')      // { issues: [...] }
```

### bigint

Validate BigInt values.

```typescript
v.bigint()

// Examples
v.bigint().execute(BigInt(123))  // { value: 123n }
v.bigint().execute(123)          // { issues: [...] }
```

### symbol

Validate Symbol values.

```typescript
v.symbol()

// Examples
const sym = Symbol('test')
v.symbol().execute(sym)          // { value: Symbol(test) }
```

## Literal Types

### literal

Validate specific literal values.

```typescript
v.literal('active')
v.literal(42)
v.literal(true)

// Examples
v.literal('admin').execute('admin')    // { value: 'admin' }
v.literal('admin').execute('user')     // { issues: [...] }
```

## Special Types

### null_, undefined_

Validate null and undefined.

```typescript
v.null_()         // Validates null
v.undefined_()    // Validates undefined

// Examples
v.null_().execute(null)          // { value: null }
v.undefined_().execute(undefined) // { value: undefined }
```

### unknown, any, never

Validate unknown/any/never types.

```typescript
v.unknown()       // Accept anything
v.any()          // Accept anything (less strict)
v.never()        // Accept nothing

// Examples
v.unknown().execute(anything)    // { value: anything }
```

### json

Validate JSON-compatible values.

```typescript
v.json()

// Examples
v.json().execute({ name: 'John' })  // { value: {...} }
v.json().execute(new Date())        // { issues: [...] }
```

## Structural Types

### object

Validate object shapes.

```typescript
v.object({
  name: v.string(),
  age: v.number(),
})

// Examples
v.object({name: v.string()}).execute({name: 'John'})
// { value: {name: 'John'} }

// Extra fields allowed by default
v.object({name: v.string()}).execute({name: 'John', email: 'john@example.com'})
// { value: {name: 'John', email: 'john@example.com'} }
```

### strictObject

Validate objects without extra fields.

```typescript
v.strictObject({
  name: v.string(),
  age: v.number(),
})

// Rejects extra fields
v.strictObject({name: v.string()}).execute({name: 'John', extra: 'field'})
// { issues: [...] }
```

### looseObject

Validate object values loosely (converts to object if needed).

```typescript
v.looseObject({
  name: v.string(),
})
```

### array

Validate array elements.

```typescript
v.array(v.string())

// Examples
v.array(v.string()).execute(['a', 'b'])  // { value: ['a', 'b'] }
v.array(v.string()).execute([1, 2])      // { issues: [...] }
```

### union

Validate one of multiple schemas.

```typescript
v.union([
  v.object({type: v.literal('user'), name: v.string()}),
  v.object({type: v.literal('admin'), permissions: v.array(v.string())}),
])

// Discriminated union
const schema = v.union([
  v.literal('draft'),
  v.literal('published'),
  v.literal('archived'),
])
```

### intersection

Combine multiple schemas (all must pass).

```typescript
v.intersection([
  v.object({name: v.string()}),
  v.object({age: v.number()}),
])

// Result validates both schemas
```

### instance

Validate class instances.

```typescript
class User {
  constructor(public name: string) {}
}

v.instance(User)

// Examples
v.instance(User).execute(new User('John'))  // { value: User {...} }
v.instance(User).execute({name: 'John'})    // { issues: [...] }
```

## Constraints

### min

Validate minimum value/length.

```typescript
v.string().min(3)          // Minimum 3 characters
v.number().min(0)          // Minimum 0
v.array(v.string()).min(1) // Minimum 1 element

// Custom message
v.string().min(3, 'Must be at least 3 characters')
```

### max

Validate maximum value/length.

```typescript
v.string().max(100)        // Maximum 100 characters
v.number().max(100)        // Maximum 100
v.array(v.string()).max(10) // Maximum 10 elements

// Custom message
v.string().max(100, 'Must be at most 100 characters')
```

### integer

Validate whole numbers.

```typescript
v.number().integer()

// Examples
v.number().integer().execute(42)    // { value: 42 }
v.number().integer().execute(42.5)  // { issues: [...] }
```

### empty

Validate empty values.

```typescript
v.string().empty()        // Validate empty string
v.array(v.string()).empty() // Validate empty array

// Reject empty
v.string().min(1) // Alternative: min(1) rejects empty
```

### startsWith

Validate string prefix.

```typescript
v.string().startsWith('http')

// Custom message
v.string().startsWith('http', 'Must start with http')
```

### endsWith

Validate string suffix.

```typescript
v.string().endsWith('.com')

// Custom message
v.string().endsWith('.com', 'Must end with .com')
```

## Transforms

### transform

Custom transformation.

```typescript
v.string().use((s) => s.toUpperCase())

type Result = InferOutput<...> // string
```

### toTrimmed

Remove whitespace from string.

```typescript
v.string().toTrimmed()

// Examples
v.string().toTrimmed().execute('  hello  ')  // { value: 'hello' }
```

### toLowercase

Convert string to lowercase.

```typescript
v.string().toLowercase()
```

### toUppercase

Convert string to uppercase.

```typescript
v.string().toUppercase()
```

### toLength

Get string/array length.

```typescript
v.string().toLength().number().min(5)

// Transforms: 'hello' → 5
```

### toFiltered

Filter array elements.

```typescript
v.array(v.string())
  .toFiltered((s) => s.length > 0)

// Removes empty strings
```

### toSorted

Sort array elements.

```typescript
v.array(v.number())
  .toSorted()

// Results in sorted array
```

### toSliced

Slice array/string.

```typescript
v.array(v.string())
  .toSliced(0, 5)  // First 5 elements

v.string()
  .toSliced(0, 10) // First 10 characters
```

### toSplitted

Split string into array.

```typescript
v.string()
  .toSplitted(',')
  .array(v.string().toTrimmed())

// 'a, b, c' → ['a', 'b', 'c']
```

### toString

Convert to string.

```typescript
v.number()
  .toString()
  .string()

// 42 → '42'
```

### parseJSON

Parse JSON string.

```typescript
v.string()
  .parseJSON()
  .object({name: v.string()})

// '{"name":"John"}' → {name: 'John'}
```

### stringifyJSON

Stringify to JSON.

```typescript
v.object({name: v.string()})
  .stringifyJSON()
  .string()

// {name: 'John'} → '{"name":"John"}'
```

### toAsync

Convert to async validation.

```typescript
v.string()
  .toAsync()
  .check(async (s) => !(await emailExists(s)))
```

## Flow Control

### check

Custom validation check.

```typescript
v.string().check((s) => s.includes('@'))

// With custom message
v.string().check((s) => s.includes('@'), 'Must contain @')

// Async check
v.string().check(async (s) => !(await emailExists(s)))
```

### fallback

Provide default value on failure.

```typescript
v.string().fallback(() => 'default')

// Always succeeds
const result = schema.execute(undefined)
// { value: 'default' }
```

### use

Transform/map value.

```typescript
v.string().use((s) => s.toUpperCase())

// Like transform but more flexible
v.object({name: v.string()})
  .use((obj) => ({...obj, id: generateId()}))
```

### as

Type assertion (use with caution).

```typescript
v.unknown()
  .as<string>()  // Assert as string
```

### generic

Generic type parameter.

```typescript
function createArraySchema<T>(itemSchema: any) {
  return v.array(itemSchema).generic<T>()
}
```

## Type Variants

### looseNumber

Parse number from various formats.

```typescript
v.looseNumber()

// Examples
v.looseNumber().execute('42')     // { value: 42 }
v.looseNumber().execute(42)       // { value: 42 }
v.looseNumber().execute('42px')   // { value: 42 }
```

## Advanced

### Async Validation

Any step can be async:

```typescript
const schema = v.string()
  .check(async (email) => {
    const exists = await checkEmailExists(email)
    return !exists
  })

const result = await schema.execute(email)
```

### Chaining

All steps are chainable:

```typescript
const schema = v.string()
  .toTrimmed()
  .toLowercase()
  .min(3)
  .max(100)
  .check((s) => !profanity.test(s))
  .check(async (s) => !(await isReserved(s)))
```

### Type Inference

Automatic type tracking:

```typescript
import { InferOutput, InferInput } from 'valchecker'

const schema = v.object({...})
type Output = InferOutput<typeof schema>
type Input = InferInput<typeof schema>
```

## Tips

- Schemas are **reusable** - Create once, validate many times
- Validation **fails fast** - First error stops validation
- All steps are **chainable** - Build complex validations easily
- Types are **inferred** - Get TypeScript support automatically
- Messages are **customizable** - Provide helpful errors
- Async is **first-class** - Support async checks natively
