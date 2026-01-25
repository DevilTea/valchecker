# Error Handling Guide

How to handle validation errors effectively in Valchecker schemas.

## Result Structure

Validation returns a discriminated union:

```typescript
type ValidationResult = 
  | { value: T }                  // Success
  | { issues: ValidationIssue[] } // Failure
```

## Checking Results

### Pattern Matching

```typescript
const result = schema.execute(data)

if ('value' in result) {
  // Success - use result.value
  const validated = result.value
} else {
  // Failure - use result.issues
  const errors = result.issues
}
```

### Guaranteed Properties

```typescript
const result = schema.execute(data)

if ('value' in result) {
  // result.value is available and typed
  // result.issues is NOT available
  console.log(result.value)
} else {
  // result.issues is available
  // result.value is NOT available
  console.log(result.issues.length)
}
```

## Issue Structure

Each issue contains:

```typescript
interface ValidationIssue {
  code: string        // 'string:expected_string', 'min:expected_min', etc.
  message: string     // Human-readable error message
  path?: (string | number)[] // Path to field: ['address', 'zip']
  value?: unknown     // The invalid value
}
```

## Accessing Issues

### By Code

```typescript
const result = schema.execute(data)

if ('issues' in result) {
  // Find specific error types
  const stringErrors = result.issues.filter((i) => i.code.startsWith('string:'))
  const minErrors = result.issues.filter((i) => i.code === 'min:expected_min')
}
```

### By Path

```typescript
const result = schema.execute(data)

if ('issues' in result) {
  // Group errors by field
  const errorsByField: Record<string, ValidationIssue[]> = {}
  
  for (const issue of result.issues) {
    const fieldPath = issue.path?.join('.') ?? 'root'
    if (!errorsByField[fieldPath]) {
      errorsByField[fieldPath] = []
    }
    errorsByField[fieldPath].push(issue)
  }
}
```

### By Severity

```typescript
const result = schema.execute(data)

if ('issues' in result) {
  // Type-based filtering
  const typeErrors = result.issues.filter((i) => 
    i.code.includes('expected_')
  )
  
  const constraintErrors = result.issues.filter((i) =>
    i.code.includes('min:') || i.code.includes('max:')
  )
}
```

## Custom Error Messages

### During Validation

```typescript
const schema = v.object({
  age: v.number()
    .integer('Age must be a whole number')
    .min(0, 'Age must be 0 or higher')
    .max(150, 'Age seems unrealistic'),
})

const result = schema.execute({ age: -5 })
// issues: [{ code: 'min:expected_min', message: 'Age must be 0 or higher' }]
```

### Check Step Messages

```typescript
const schema = v.string()
  .check(
    (email) => email.includes('@'),
    'Please provide a valid email address'
  )
```

## Error Display

### For Web Forms

```typescript
function displayFormErrors(issues: ValidationIssue[]) {
  const errorMap: Record<string, string[]> = {}
  
  for (const issue of issues) {
    const fieldName = issue.path?.[0] as string ?? 'general'
    if (!errorMap[fieldName]) {
      errorMap[fieldName] = []
    }
    errorMap[fieldName].push(issue.message)
  }
  
  return errorMap
}

// Usage
const result = schema.execute(formData)
if ('issues' in result) {
  const errors = displayFormErrors(result.issues)
  // Render errors in UI
}
```

### Console Output

```typescript
function logErrors(issues: ValidationIssue[]) {
  for (const issue of issues) {
    const path = issue.path?.join('.') ?? 'root'
    console.error(`${path}: ${issue.message} (${issue.code})`)
  }
}
```

### JSON Response

```typescript
function jsonErrors(issues: ValidationIssue[]) {
  return {
    success: false,
    errors: issues.map((issue) => ({
      path: issue.path?.join('.'),
      code: issue.code,
      message: issue.message,
    })),
  }
}
```

## Handling Partial Data

### Continue on Partial Validation

```typescript
const schema = v.object({
  required_field: v.string(),
  optional_field: [v.string()],
})

// Process what we can
const result = schema.execute(data)

if ('value' in result) {
  await processValid(result.value)
} else {
  // Check which fields have errors
  for (const issue of result.issues) {
    const field = issue.path?.[0] as string
    if (field === 'optional_field') {
      // Optional field failed - can skip
      console.log('Optional field validation failed:', issue.message)
    } else {
      // Required field failed - must address
      console.error('Required field validation failed:', issue.message)
    }
  }
}
```

### Fallback Values

```typescript
const schema = v.object({
  name: v.string(),
  theme: v.string()
    .fallback(() => 'light'),  // Has fallback
  language: v.string()
    .fallback(() => 'en'),     // Has fallback
})

// Always succeeds if name is valid
const result = schema.execute(data)
```

## Async Error Handling

### Catching Async Errors

```typescript
const schema = v.string()
  .check(async (email) => {
    try {
      const exists = await checkEmailExists(email)
      return !exists  // Valid if doesn't exist
    } catch (error) {
      throw new Error('Email service unavailable')
    }
  })

// Use with try-catch
try {
  const result = await schema.execute(email)
  if ('value' in result) {
    // Process
  } else {
    // Handle validation errors
  }
} catch (error) {
  // Handle unexpected errors
}
```

### Timeout Handling

```typescript
const schema = v.string()
  .check(async (value) => {
    const promise = checkService(value)
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 5000)
    )
    
    try {
      return await Promise.race([promise, timeout])
    } catch (error) {
      throw new Error('Service check failed')
    }
  })
```

## Error Recovery Strategies

### Retry Logic

```typescript
async function validateWithRetry(data: unknown, maxRetries = 3) {
  let lastError
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await schema.execute(data)
      if ('value' in result) {
        return result.value
      }
      
      // Validation failed, return errors
      throw new ValidationError(result.issues)
    } catch (error) {
      lastError = error
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
      }
    }
  }
  
  throw lastError
}
```

### Data Sanitization

```typescript
const schema = v.object({
  name: v.string()
    .toTrimmed()      // Remove whitespace
    .check((s) => s.length > 0, 'Name is required'),
  email: v.string()
    .toTrimmed()
    .toLowercase(),   // Normalize case
  tags: v.array(v.string())
    .use((arr) => [...new Set(arr)]), // Remove duplicates
})

const result = schema.execute(rawData)
```

### Graceful Degradation

```typescript
const schema = v.object({
  // Required
  id: v.number().integer(),
  name: v.string(),
  
  // Optional with fallbacks
  description: v.string().fallback(() => ''),
  tags: v.array(v.string()).fallback(() => []),
  metadata: v.object({}).fallback(() => ({})),
})

// Always succeeds
const result = schema.execute(data)
```

## Testing Error Handling

```typescript
describe('error handling', () => {
  it('should collect multiple errors', () => {
    const result = schema.execute({
      name: '',     // Empty
      age: -5,      // Negative
      email: 'no-at-sign', // Invalid
    })
    
    if ('issues' in result) {
      expect(result.issues.length).toBeGreaterThan(2)
      expect(result.issues.some((i) => i.path?.[0] === 'name')).toBe(true)
      expect(result.issues.some((i) => i.path?.[0] === 'age')).toBe(true)
    }
  })
  
  it('should provide helpful messages', () => {
    const result = schema.execute({ age: 'not a number' })
    
    if ('issues' in result) {
      expect(result.issues[0].message).toMatch(/number/)
    }
  })
})
```
