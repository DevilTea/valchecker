# Testing Guide

All step implementations require 100% code coverage. This guide covers testing best practices.

## Coverage Requirement

**100% code coverage is mandatory** for all step implementations. This includes:
- All code paths
- Error conditions
- Custom message handling
- Async behavior (if applicable)

## Test File Template

```typescript
import { describe, expect, it } from 'vitest'
import { createValchecker, /* required steps */ } from 'valchecker'
import { stepName } from './step-name'

/**
 * Test plan for [step] step:
 * - Functions tested: stepName()
 * - Valid inputs: [list expected valid inputs]
 * - Invalid inputs: [list expected invalid inputs]
 * - Edge cases: [list edge cases]
 * - Coverage goals: 100%
 */

const v = createValchecker({ steps: [/* steps */] })

describe('stepName plugin', () => {
  describe('valid inputs', () => {
    it('should pass for [condition]', () => {
      const schema = v./* chain */
      expect(schema.run(validInput)).toEqual({ isOk: true, value: expectedValue })
    })
  })

  describe('invalid inputs', () => {
    it('should fail for [condition]', () => {
      const schema = v./* chain */
      const result = schema.run(invalidInput)
      expect(result.isOk).toBe(false)
      if (!result.isOk) {
        expect(result.issues[0].code).toBe('stepName:issue_code')
      }
    })
  })

  describe('custom messages', () => {
    it('should use string message', () => {
      const schema = v./* chain */.stepName('Custom message')
      const result = schema.run(invalidInput)
      if (!result.isOk) {
        expect(result.issues[0].message).toBe('Custom message')
      }
    })

    it('should use message function', () => {
      const schema = v./* chain */.stepName(({ payload }) => `Value: ${payload.value}`)
      // ...
    })
  })

  describe('chaining', () => {
    it('should work with other steps', () => {
      // Test step works correctly in a chain
    })
  })

  describe('async behavior', () => {
    it('should handle async validation', async () => {
      // If step supports async
    })
  })
})
```

## Test Organization

Organize tests into logical describe blocks:

1. **Valid Inputs** - Test all valid input scenarios
2. **Invalid Inputs** - Test error conditions
3. **Custom Messages** - Test string and function message handlers
4. **Chaining** - Test interaction with other steps
5. **Async Behavior** - Test async functionality (if applicable)

## Writing Effective Tests

### Valid Inputs

Test all scenarios where validation should pass:

```typescript
describe('valid inputs', () => {
  it('should pass for positive numbers', () => {
    const schema = v.number().min(0)
    expect(schema.run(5)).toEqual({ isOk: true, value: 5 })
  })

  it('should pass for zero', () => {
    const schema = v.number().min(0)
    expect(schema.run(0)).toEqual({ isOk: true, value: 0 })
  })

  it('should pass for large numbers', () => {
    const schema = v.number().min(0)
    expect(schema.run(Number.MAX_SAFE_INTEGER)).toEqual({ isOk: true, value: Number.MAX_SAFE_INTEGER })
  })
})
```

### Invalid Inputs

Test all scenarios where validation should fail:

```typescript
describe('invalid inputs', () => {
  it('should fail for negative numbers', () => {
    const schema = v.number().min(0)
    const result = schema.run(-5)
    expect(result.isOk).toBe(false)
    if (!result.isOk) {
      expect(result.issues[0].code).toBe('min:expected_min')
    }
  })

  it('should fail for wrong type', () => {
    const schema = v.number().min(0)
    const result = schema.run('not a number')
    expect(result.isOk).toBe(false)
  })
})
```

### Custom Messages

Test both string and function message handlers:

```typescript
describe('custom messages', () => {
  it('should use custom string message', () => {
    const schema = v.number().min(0, 'Must be positive')
    const result = schema.run(-5)
    if (!result.isOk) {
      expect(result.issues[0].message).toBe('Must be positive')
    }
  })

  it('should use message function with payload', () => {
    const schema = v.number().min(0, ({ payload }) => 
      `Value ${payload.value} must be at least ${payload.minimum}`
    )
    const result = schema.run(-5)
    if (!result.isOk) {
      expect(result.issues[0].message).toContain('Value -5')
    }
  })

  it('should use default message when not provided', () => {
    const schema = v.number().min(0)
    const result = schema.run(-5)
    if (!result.isOk) {
      expect(result.issues[0].message).toBeTruthy()
    }
  })
})
```

### Chaining

Test that the step works correctly in chains:

```typescript
describe('chaining', () => {
  it('should work with other constraints', () => {
    const schema = v.number().min(0).max(100)
    expect(schema.run(50)).toEqual({ isOk: true, value: 50 })
    expect(schema.run(101).isOk).toBe(false)
  })

  it('should work with transforms', () => {
    const schema = v.string().toTrimmed().min(1)
    expect(schema.run('  hello  ')).toEqual({ isOk: true, value: 'hello' })
  })
})
```

### Async Behavior

If your step handles async operations:

```typescript
describe('async behavior', () => {
  it('should handle async validation', async () => {
    const schema = v.string().toAsync()
    const result = await schema.runAsync('hello')
    expect(result).toEqual({ isOk: true, value: 'hello' })
  })
})
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific step
pnpm test packages/internal/src/steps/step-name

# Run with coverage
pnpm test --coverage

# Watch mode
pnpm test --watch

# Check specific coverage
pnpm test --coverage -- --reporter=text-summary
```

## Coverage Tips

- Test both success and failure paths
- Cover all branches in conditional logic
- Test edge cases (empty, null, undefined, etc.)
- Use `it.skip` for temporarily disabling tests (must be removed before commit)
- Run `pnpm test --coverage` to identify uncovered lines

## Common Pitfalls

1. **Not checking `isOk` before accessing `value`/`issues`**
   ```typescript
   // ✗ Bad - might crash if isOk is false
   expect(result.value).toBe(5)
   
   // ✓ Good
   expect(result.isOk).toBe(true)
   if (result.isOk) {
     expect(result.value).toBe(5)
   }
   ```

2. **Not testing error conditions**
   ```typescript
   // ✗ Bad - only tests success
   it('should work', () => {
     expect(schema.run(5)).toEqual({ isOk: true, value: 5 })
   })
   
   // ✓ Good - tests both
   it('should pass for valid input', () => {
     expect(schema.run(5)).toEqual({ isOk: true, value: 5 })
   })
   it('should fail for invalid input', () => {
     const result = schema.run(-5)
     expect(result.isOk).toBe(false)
   })
   ```

3. **Forgetting custom message tests**
   - Always test both string and function message handlers
   - Test that default message is used when not provided

4. **Not testing in chains**
   - Test the step works with other steps
   - Test order matters in some cases
