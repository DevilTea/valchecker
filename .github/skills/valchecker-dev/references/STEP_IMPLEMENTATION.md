# Step Implementation Guide

## Step Anatomy

Every validation step follows this structure:

```typescript
export const myStep = implStepPlugin<{
  CurrentValchecker: InitialValchecker
}>(({ createStep, expected, utils }) => {
  return createStep({
    name: 'myStep',
    expected,
    step(value, issue) {
      // Implementation
    }
  })
})
```

## Step Template

Use this template when creating a new step:

```typescript
import type { StepMethodUtils } from '@valchecker/internal'
import { implStepPlugin } from '@valchecker/internal'

export const myStep = implStepPlugin<{
  CurrentValchecker: InitialValchecker
}>(({ createStep, expected, utils }) => {
  return createStep({
    name: 'myStep',
    expected,
    
    step(value, issue) {
      // Validation logic here
      
      if (isValid(value)) {
        // Return success
        return {
          value: transformedValue
        }
      } else {
        // Return failure
        return {
          issue: createIssue({
            code: 'myStep:error_code',
            message: 'Error description',
            payload: { /* context data */ }
          })
        }
      }
    }
  })
})
```

## Creating Files

### Implementation File (myStep.ts)

Location: `packages/internal/src/steps/myStep/myStep.ts`

Must include:
- `implStepPlugin()` wrapper
- Type definition with `CurrentValchecker`
- `createStep()` call with name and logic
- Clear error codes and messages
- Support for both sync and async

### Test File (myStep.test.ts)

Location: `packages/internal/src/steps/myStep/myStep.test.ts`

Requirements:
- 100% code coverage
- Test happy path
- Test error cases
- Test edge cases
- Test async if applicable

Example:
```typescript
import { describe, it, expect } from 'vitest'
import { createValchecker } from '@valchecker/internal'
import { myStep } from './myStep'

describe('myStep', () => {
  const v = createValchecker({ steps: [myStep] })
  const schema = v.unknown().myStep()

  it('should validate correct values', () => {
    const result = schema.execute(validValue)
    expect(v.isSuccess(result)).toBe(true)
    expect(result.value).toBe(expectedValue)
  })

  it('should reject invalid values', () => {
    const result = schema.execute(invalidValue)
    expect(v.isFailure(result)).toBe(true)
    expect(result.issues[0].code).toBe('myStep:error')
  })
})
```

### Benchmark File (myStep.bench.ts)

Location: `packages/internal/src/steps/myStep/myStep.bench.ts`

```typescript
import { bench, describe } from 'vitest'
import { createValchecker } from '@valchecker/internal'
import { myStep } from './myStep'

describe('myStep bench', () => {
  const v = createValchecker({ steps: [myStep] })
  const schema = v.unknown().myStep()

  bench('should validate quickly', () => {
    schema.execute(testValue)
  })
})
```

### Index File (index.ts)

Location: `packages/internal/src/steps/myStep/index.ts`

```typescript
export * from './myStep'
```

## Step Types

### Validation Steps
Check if a value matches a type or condition.

Example: `string`, `number`, `array`

```typescript
step(value, issue) {
  if (typeof value === 'string') {
    return { value }
  }
  return {
    issue: createIssue({
      code: 'string:expected_string',
      message: 'Expected string'
    })
  }
}
```

### Transformation Steps
Transform valid values.

Example: `toUppercase`, `transform`

```typescript
step(value, issue) {
  if (typeof value === 'string') {
    return { value: value.toUpperCase() }
  }
  // Pass failure through
  return { issue }
}
```

### Operator Steps
Compose or modify validation behavior.

Example: `check`, `fallback`, `use`

```typescript
step(value, issue) {
  if (v.isFailure(result)) {
    // Handle failure or apply fallback
    return { value: fallbackValue }
  }
  return result
}
```

## Error Code Convention

Format: `stepName:error_type`

Examples:
- `string:expected_string`
- `number:expected_number`
- `min:value_too_small`
- `array:item_error`

## Handling Async

Steps can work with async naturally:

```typescript
step(value, issue) {
  if (someCondition) {
    return {
      // Returning Promise makes this async
      value: Promise.resolve(transformedValue)
    }
  }
  return { value }
}
```

Or use `toAsync` step wrapper for explicit async.

## Handling Paths

For nested validation failures, prepend path:

```typescript
import { prependIssuePath } from '@valchecker/internal'

// When validating array items:
for (let i = 0; i < array.length; i++) {
  const itemResult = validateItem(array[i])
  if (v.isFailure(itemResult)) {
    const issue = prependIssuePath(
      itemResult.issues[0],
      [i] // Path to this item
    )
    return { issue }
  }
}
```

## Composition Example: check step

The `check` step enables custom validation:

```typescript
export const check = implStepPlugin<{
  CurrentValchecker: Valchecker
}>(({ createStep, expected }) => {
  return createStep({
    name: 'check',
    expected,
    
    step(value, issue) {
      if (v.isFailure(lastResult)) {
        return lastResult // Pass through failures
      }
      
      // Apply predicate
      const checkResult = predicate(value)
      
      if (checkResult === true) {
        return { value }
      }
      
      return {
        issue: createIssue({
          code: 'check:failed',
          message: typeof checkResult === 'string' 
            ? checkResult 
            : 'Check failed',
          payload: { value }
        })
      }
    }
  })
})
```

## Best Practices

### 1. Performance
- Avoid unnecessary object allocations
- Pre-compute values when possible
- Use early returns for quick paths
- Profile hot operations

### 2. Type Safety
- Always specify `CurrentValchecker` type
- Use proper interfaces for issues
- Leverage TypeScript for validation

### 3. Testing
- Test all code paths
- Use meaningful test descriptions
- Include edge cases
- Mock external dependencies

### 4. Documentation
- Write clear error messages
- Document special behaviors
- Explain constraints

### 5. Error Handling
- Provide useful error codes
- Include relevant context in payload
- Preserve error paths through pipeline

## Registration

After implementation, register in `packages/all-steps/src/allSteps/allSteps.ts`:

```typescript
import { myStep } from '../../../internal/src/steps/myStep'

export const allSteps: StepPluginImpl[] = [
  // ... existing steps
  myStep,  // Add here
]
```

## Verification Checklist

Before committing:

- [ ] Implementation uses `implStepPlugin()`
- [ ] Test file has 100% coverage
- [ ] Benchmark file exists (if performance-critical)
- [ ] Error codes follow convention
- [ ] Index file exports step
- [ ] Step registered in allSteps
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm bench` shows no regression
- [ ] Documentation updated

---

See ARCHITECTURE.md for project structure details.
