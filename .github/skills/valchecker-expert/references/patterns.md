# Common Patterns

Practical examples for common validation scenarios.

## Form Validation

### Basic Form

```typescript
const formSchema = v.object({
  email: v.string()
    .toTrimmed()
    .toLowercase()
    .min(5),
  password: v.string()
    .min(8)
    .check((pwd) => /[A-Z]/.test(pwd), 'Must contain uppercase'),
  confirmPassword: v.string(),
})
  .check((data) => data.password === data.confirmPassword, 'Passwords must match')

const result = formSchema.execute(formData)

if ('value' in result) {
  // Form is valid
  await submitForm(result.value)
} else {
  // Show errors to user
  displayFormErrors(result.issues)
}
```

### React Form Integration

```typescript
import { useState } from 'react'

function LoginForm() {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const result = loginSchema.execute({
      email: formData.get('email'),
      password: formData.get('password'),
    })

    if ('value' in result) {
      // Success
      login(result.value)
    } else {
      // Map errors by field
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.issues) {
        const field = issue.path?.[0] as string
        if (field) fieldErrors[field] = issue.message
      }
      setErrors(fieldErrors)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" />
      {errors.email && <span>{errors.email}</span>}
      {/* ... */}
    </form>
  )
}
```

## API Request Validation

### Query Parameters

```typescript
const querySchema = v.object({
  page: v.number()
    .integer()
    .min(1)
    .fallback(() => 1),
  limit: v.number()
    .integer()
    .min(1)
    .max(100)
    .fallback(() => 20),
  sort: [v.string()],
  search: [v.string()],
})

export const apiHandler = (req: Request) => {
  const result = querySchema.execute(req.query)
  
  if ('value' in result) {
    // Safe to use with defaults applied
    const { page, limit, sort, search } = result.value
    return fetchResults(page, limit, sort, search)
  }
  
  return res.status(400).json({ errors: result.issues })
}
```

### Request Body

```typescript
const createUserSchema = v.object({
  name: v.string().toTrimmed().min(1),
  email: v.string().toTrimmed().toLowercase(),
  age: [v.number().integer().min(0)],
})

export const POST = async (req: Request) => {
  const body = await req.json()
  const result = createUserSchema.execute(body)
  
  if ('value' in result) {
    // Save to database
    const user = await db.users.create(result.value)
    return Response.json(user, { status: 201 })
  }
  
  return Response.json({ errors: result.issues }, { status: 400 })
}
```

## Database Validation

### Before Insert

```typescript
const insertUserSchema = v.object({
  name: v.string().toTrimmed().min(1).max(255),
  email: v.string().toTrimmed().toLowercase(),
  phone: [v.string().toTrimmed()],
  created_at: v.literal(new Date().toISOString()),
})

async function insertUser(data: unknown) {
  const result = insertUserSchema.execute(data)
  
  if ('value' in result) {
    return db.users.insert(result.value)
  }
  
  throw new ValidationError(result.issues)
}
```

### Before Update

```typescript
const updateUserSchema = v.object({
  name: [v.string().toTrimmed().min(1)],
  email: [v.string().toLowercase()],
  age: [v.number().integer().min(0)],
})

async function updateUser(id: number, updates: unknown) {
  const result = updateUserSchema.execute(updates)
  
  if ('value' in result) {
    return db.users.update(id, result.value)
  }
  
  throw new ValidationError(result.issues)
}
```

## Enum Validation

### Literal Unions

```typescript
const statusSchema = v.union([
  v.literal('draft'),
  v.literal('published'),
  v.literal('archived'),
])

type Status = InferOutput<typeof statusSchema>

const articleSchema = v.object({
  title: v.string(),
  status: statusSchema,
  tags: v.array(v.string()),
})
```

### Dynamic Enums

```typescript
const ROLES = ['admin', 'user', 'guest'] as const

const roleSchema = v.union(
  ROLES.map((role) => v.literal(role))
)

type Role = InferOutput<typeof roleSchema>
```

## Nested Validation

### Configuration Objects

```typescript
const configSchema = v.object({
  server: v.object({
    host: v.string(),
    port: v.number().integer().min(1).max(65535),
  }),
  database: v.object({
    url: v.string(),
    pool: v.object({
      min: v.number().integer().min(1),
      max: v.number().integer().min(1),
    }),
  }),
})

const config = configSchema.execute(process.env)
```

### Array of Objects

```typescript
const itemsSchema = v.array(
  v.object({
    id: v.number(),
    quantity: v.number().integer().min(1),
    price: v.number().min(0),
  })
)

const orderSchema = v.object({
  orderId: v.string(),
  items: itemsSchema,
  total: v.number().min(0),
})
```

## Type Conversions

### String to Number

```typescript
const schema = v.string()
  .use((val) => parseInt(val, 10))
  .number()
  .integer()
  .min(0)

const result = schema.execute('42')
// { value: 42 }
```

### JSON Parsing

```typescript
const configSchema = v.string()
  .parseJSON()
  .object({
    name: v.string(),
    enabled: v.boolean(),
  })

const result = configSchema.execute('{"name":"app","enabled":true}')
// { value: { name: 'app', enabled: true } }
```

### CSV Parsing

```typescript
const csvSchema = v.string()
  .toSplitted(',')
  .toFiltered((s) => s.trim().length > 0)
  .toFiltered((s) => !s.startsWith('#'))
  .array(v.string().toTrimmed())

const result = csvSchema.execute('apple,banana,cherry')
// { value: ['apple', 'banana', 'cherry'] }
```

## Composition

### Reusable Schemas

```typescript
// Define base schemas
const emailSchema = v.string()
  .toTrimmed()
  .toLowercase()
  .check((s) => s.includes('@'))

const phoneSchema = v.string()
  .toTrimmed()
  .check((s) => /^\d{10,15}$/.test(s))

// Compose them
const contactSchema = v.object({
  email: emailSchema,
  phone: [phoneSchema],
})

const userSchema = v.object({
  name: v.string().toTrimmed(),
  contact: contactSchema,
})

type User = InferOutput<typeof userSchema>
```

### Schema Mixins

```typescript
// Metadata fields
const withTimestamps = {
  created_at: v.string(),
  updated_at: v.string(),
}

const userSchema = v.object({
  id: v.number(),
  name: v.string(),
  ...withTimestamps,
})

// But better with composition:
const baseSchema = v.object({
  id: v.number(),
  name: v.string(),
})

const withMetadataSchema = v.object({
  ...baseSchema,
  created_at: v.string(),
  updated_at: v.string(),
})
```

## Error Recovery

### Fallback Values

```typescript
const schema = v.object({
  theme: v.union([v.literal('light'), v.literal('dark')])
    .fallback(() => 'light'),
  language: v.string()
    .fallback(() => 'en'),
})

// Always succeeds
const result = schema.execute({})
// { value: { theme: 'light', language: 'en' } }
```

### Partial Validation

```typescript
const result = schema.execute(data)

if ('value' in result) {
  console.log('All valid')
} else {
  // Check specific errors
  const emailErrors = result.issues.filter((i) => i.path?.[0] === 'email')
  
  if (emailErrors.length > 0) {
    // Handle email errors specially
  } else {
    // All other errors
  }
}
```

## Performance Patterns

### Lazy Validation

```typescript
// Create schema once
const userSchema = v.object({ /* ... */ })

// Reuse for many validations
for (const item of largeArray) {
  const result = userSchema.execute(item)
  // Process result
}
```

### Stream Validation

```typescript
async function* validateStream(stream: AsyncIterable<unknown>) {
  for await (const item of stream) {
    const result = userSchema.execute(item)
    if ('value' in result) {
      yield result.value
    } else {
      console.error('Invalid item:', result.issues)
    }
  }
}
```
