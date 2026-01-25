# Performance Guide

Tips and strategies for optimizing Valchecker schemas.

## Schema Reuse

### Create Once, Use Many

```typescript
// ✅ Good: Create schema once
const userSchema = v.object({
  name: v.string().min(1),
  email: v.string(),
})

// Reuse for many validations
for (const item of largeArray) {
  const result = userSchema.execute(item)
}
```

```typescript
// ❌ Bad: Creating new schema each time
for (const item of largeArray) {
  const result = v.object({
    name: v.string().min(1),
    email: v.string(),
  }).execute(item)
}
```

### Compose Reusable Schemas

```typescript
// Shared schemas
const emailSchema = v.string().min(5).check((s) => s.includes('@'))
const phoneSchema = v.string().check((s) => /^\d+$/.test(s))
const nameSchema = v.string().toTrimmed().min(1).max(100)

// Compose
const userSchema = v.object({
  name: nameSchema,
  email: emailSchema,
  phone: [phoneSchema],
})

const contactSchema = v.object({
  email: emailSchema,
  phone: phoneSchema,
})
```

## Validation Order

### Check Early Exits

```typescript
// ✅ Good: Type check first, then constraints
const schema = v.string()   // First: type check
  .min(3)                    // Then: quick constraint
  .check(isValidEmail)       // Last: expensive async

// ✅ Good: Fail fast
const schema = v.string()
  .check((s) => s.length > 0) // Quick check first
  .check(isValidEmail)        // Expensive check second
```

### Short-Circuit Unions

```typescript
// Put most common types first
const schema = v.union([
  v.literal('admin'),     // Most common
  v.literal('user'),      // Second most common
  v.literal('guest'),     // Least common
])
```

## Lazy Validation

### Defer Expensive Checks

```typescript
// ✅ Only validate when needed
async function processUser(data: unknown) {
  // Fast check first
  if (typeof data !== 'object' || !data) return
  
  // Expensive validation second
  const result = await fullUserSchema.execute(data)
  if ('value' in result) {
    return processValid(result.value)
  }
}
```

### Batch Validation

```typescript
// ✅ Good: Validate once, process multiple times
const { value: users } = usersSchema.execute(data)

for (const user of users) {
  await processUser(user)
  await saveUser(user)
  await notifyUser(user)
}
```

## Transform Efficiency

### Chain Transforms Efficiently

```typescript
// ✅ Good: Combine related transforms
const schema = v.string()
  .toTrimmed()
  .toLowercase()  // One pass over string

// Better for arrays: filter then sort
const schema = v.array(v.string())
  .toFiltered((s) => s.length > 0)
  .toSorted()
```

### Avoid Redundant Transforms

```typescript
// ❌ Bad: Multiple trims
const schema = v.string()
  .toTrimmed()
  .use((s) => s.trim())  // Redundant

// ✅ Good: Once is enough
const schema = v.string()
  .toTrimmed()
```

## Constraint Selection

### Use Tight Constraints

```typescript
// ✅ More efficient: Specific constraint
const schema = v.number()
  .integer()
  .min(0)
  .max(100)

// Less efficient: Generic check
const schema = v.number()
  .check((n) => Number.isInteger(n) && n >= 0 && n <= 100)
```

### Cache Regex Results

```typescript
// ✅ Create regex once
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const schema = v.string()
  .check((s) => EMAIL_REGEX.test(s))

// Reuse schema many times
for (const email of emails) {
  schema.execute(email)
}
```

## Async Optimization

### Parallelize Checks

```typescript
// ✅ Good: Parallel async checks
const schema = v.object({
  email: v.string()
    .check(async (e) => !(await emailExists(e))),
  username: v.string()
    .check(async (u) => !(await usernameExists(u))),
})

// Both checks run in parallel during validation
const result = await schema.execute(data)
```

### Cache Async Results

```typescript
// ✅ Cache expensive lookups
const emailCache = new Set<string>()

const schema = v.string()
  .check(async (email) => {
    if (emailCache.has(email)) return true
    
    const exists = await checkEmailExists(email)
    if (exists) emailCache.add(email)
    return !exists
  })
```

## Bundle Size

### Selective Imports

```typescript
// ✅ Small bundle: Only needed steps
import { createValchecker, string, number, object, min } from 'valchecker'

const v = createValchecker({ steps: [string, number, object, min] })
```

```typescript
// ⚠️ Larger bundle: All steps
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({ steps: allSteps })
```

### Tree-Shaking

```typescript
// Unused steps will be tree-shaken in production
import { string, number } from 'valchecker'

// Only string and number are included in bundle
const schema = v.string().number() // ❌ Type error, but illustrative
```

## Monitoring

### Track Validation Time

```typescript
function timeValidation<T>(schema: any, data: unknown): {
  value?: T
  issues?: any[]
  duration: number
} {
  const start = performance.now()
  const result = schema.execute(data)
  const duration = performance.now() - start
  
  return { ...result, duration }
}

// Monitor slow validations
const result = timeValidation(schema, data)
if (result.duration > 100) {
  console.warn('Slow validation:', result.duration)
}
```

### Count Issues

```typescript
// Track error patterns
function countErrors(result: ValidationResult) {
  if ('issues' in result) {
    const counts: Record<string, number> = {}
    for (const issue of result.issues) {
      counts[issue.code] = (counts[issue.code] ?? 0) + 1
    }
    return counts
  }
}
```

## Testing Performance

### Benchmark Common Schemas

```typescript
import { bench } from 'vitest'

bench('simple validation', () => {
  simpleSchema.execute(testData)
})

bench('complex validation', () => {
  complexSchema.execute(testData)
})
```

### Profile Hot Paths

```typescript
// Identify slow validations in production
const timings = new Map<string, number[]>()

function trackValidation(name: string, fn: () => any) {
  const start = performance.now()
  const result = fn()
  const duration = performance.now() - start
  
  if (!timings.has(name)) timings.set(name, [])
  timings.get(name)!.push(duration)
  
  return result
}

// Analyze
for (const [name, durations] of timings) {
  const avg = durations.reduce((a, b) => a + b) / durations.length
  console.log(`${name}: avg ${avg.toFixed(2)}ms`)
}
```

## Best Practices

1. **Create schemas once** - Reuse for many validations
2. **Validate in order** - Fast checks first, expensive last
3. **Use constraints** - More efficient than custom checks
4. **Cache results** - Avoid redundant lookups
5. **Profile realistically** - Test with actual data volumes
6. **Monitor in production** - Track slow validations
7. **Optimize async** - Parallel checks where possible
8. **Keep schemas focused** - Smaller schemas validate faster
