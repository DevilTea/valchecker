# Utils API Reference

The `utils` object passed to step implementations provides essential functions for validation.

## Available Functions

| Function | Purpose | Return Type |
|----------|---------|-------------|
| `addSuccessStep(fn)` | Register a validation function that runs on success | `void` |
| `addFailureStep(fn)` | Register a function that runs on failure (for recovery) | `void` |
| `success(value)` | Return a successful result | `SuccessResult<T>` |
| `failure(issue)` | Return a failure with single issue | `FailureResult` |
| `failure([issues])` | Return a failure with multiple issues | `FailureResult` |
| `createIssue(opts)` | Create a structured issue object | `Issue` |

## addSuccessStep

Register a validation function that receives the current value and runs when validation succeeds:

```typescript
utils.addSuccessStep((value) => {
  if (conditionFails(value)) {
    return failure(createIssue({ /* ... */ }))
  }
  return success(value)
})
```

## addFailureStep

Register a recovery function that runs when validation fails. Useful for fallback steps:

```typescript
utils.addFailureStep((issues) => {
  // Inspect issues if needed
  return success(defaultValue)  // Recover
})
```

## success

Return a successful validation result:

```typescript
// For constraint steps (no type change)
return success(value)

// For transform steps (changing the value)
return success(transformedValue)
```

## failure

Return a failed validation result:

```typescript
// Single issue
return failure(createIssue({ /* ... */ }))

// Multiple issues
return failure([
  createIssue({ code: 'step:issue1', /* ... */ }),
  createIssue({ code: 'step:issue2', /* ... */ }),
])
```

## createIssue

Create a structured issue object:

```typescript
createIssue({
  code: 'step:issue_code',      // Unique identifier (step:snake_case)
  payload: { /* data */ },      // Issue-specific data for message/debugging
  customMessage: message,       // User-provided message override (from params)
  defaultMessage: 'text',       // Fallback message when customMessage not provided
})
```

### Issue Payload

The `payload` object is passed to message handlers and should contain relevant context:

```typescript
createIssue({
  code: 'min:expected_min',
  payload: { 
    value: 5,           // The value that failed
    minimum: 10,        // The constraint value
  },
  customMessage: userMessage,
  defaultMessage: 'Expected minimum value of 10',
})
```

### Message Handlers

Users can provide custom messages in multiple ways:

```typescript
// String message
.min(5, 'Too small!')

// Message function
.min(5, ({ payload }) => `Value ${payload.value} is too small`)

// No message (uses default)
.min(5)
```

## Complete Example

```typescript
/* @__NO_SIDE_EFFECTS__ */
export const positive = implStepPlugin<PluginDef>({
  positive: ({
    utils: { addSuccessStep, success, createIssue, failure },
    params: [message],
  }) => {
    addSuccessStep((value) => {
      if (value > 0) {
        return success(value)
      }
      return failure(
        createIssue({
          code: 'positive:expected_positive',
          payload: { value },
          customMessage: message,
          defaultMessage: `Expected positive number, got ${value}`,
        }),
      )
    })
  },
})
```
