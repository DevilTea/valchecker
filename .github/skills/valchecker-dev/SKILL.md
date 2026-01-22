---
name: valchecker-dev
description: Comprehensive guide for developing and contributing to the Valchecker validation library. Use this skill when working on the valchecker codebase itself - adding new steps, fixing bugs, or improving core functionality.
---

# Valchecker Development Guide

This skill provides comprehensive guidance for contributing to the Valchecker validation library. Use this when developing new features, fixing bugs, or improving existing functionality within the valchecker repository.

## Project Structure

Valchecker is a pnpm monorepo with three packages:

```
valchecker/
├── packages/
│   ├── internal/         # @valchecker/internal - Core implementation
│   │   ├── src/
│   │   │   ├── core/     # Core types and functions
│   │   │   │   ├── types.ts    # All TypeScript type definitions
│   │   │   │   └── core.ts     # createValchecker, implStepPlugin
│   │   │   ├── steps/    # 47+ validation step plugins
│   │   │   │   ├── string/
│   │   │   │   ├── number/
│   │   │   │   ├── object/
│   │   │   │   └── ... (each step in its own directory)
│   │   │   └── shared/   # Shared utilities
│   │   └── tests/
│   ├── all-steps/        # @valchecker/all-steps - Convenience export
│   │   └── src/allSteps/ # Dynamic collection of all steps
│   └── valchecker/       # valchecker - Main package (re-exports both)
├── docs/                 # VitePress documentation site
└── AGENTS.md             # Quick reference for AI agents
```

## Development Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test --coverage

# Run benchmarks
pnpm bench

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Step Implementation Pattern

Every validation step follows a three-layer pattern. This is the most important concept to understand.

### Layer 1: Meta (Type Metadata)

Defines the step's type information:

```typescript
type Meta = DefineStepMethodMeta<{
  Name: 'stepName'                              // Method name in chain
  ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: InputType }>  // Required input type
  SelfIssue: ExecutionIssue<'stepName:issue_code', { value: unknown }>  // Issue type
}>
```

### Layer 2: PluginDef (TypeScript Interface)

Defines the method signature with JSDoc:

```typescript
interface PluginDef extends TStepPluginDef {
  /**
   * ### Description:
   * Brief explanation of what the step does.
   *
   * ---
   *
   * ### Example:
   * ```ts
   * const v = createValchecker({ steps: [string, myStep] })
   * const schema = v.string().myStep()
   * ```
   *
   * ---
   *
   * ### Issues:
   * - `'stepName:issue_code'`: When this issue occurs.
   */
  stepName: DefineStepMethod<
    Meta,
    this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
      ? (message?: MessageHandler<Meta['SelfIssue']>) => Next<
          { output: OutputType, issue: Meta['SelfIssue'] },
          this['CurrentValchecker']
        >
      : never
  >
}
```

### Layer 3: Implementation (Runtime Logic)

Implements the actual validation:

```typescript
/* @__NO_SIDE_EFFECTS__ */
export const stepName = implStepPlugin<PluginDef>({
  stepName: ({
    utils: { addSuccessStep, success, createIssue, failure },
    params: [message],
  }) => {
    addSuccessStep((value) => {
      if (/* validation passes */) {
        return success(value)  // or success(transformedValue)
      }
      return failure(
        createIssue({
          code: 'stepName:issue_code',
          payload: { value },
          customMessage: message,
          defaultMessage: 'Default error message.',
        }),
      )
    })
  },
})
```

## File Structure for Steps

Every step MUST have this directory structure:

```
packages/internal/src/steps/[step-name]/
├── [step-name].ts       # Implementation (required)
├── [step-name].test.ts  # Tests with 100% coverage (required)
├── [step-name].bench.ts # Benchmarks (required)
└── index.ts             # Re-export (required)
```

The `index.ts` should simply re-export:
```typescript
export * from './step-name'
```

After creating a new step, add it to `packages/internal/src/steps/index.ts`:
```typescript
export * from './step-name'
```

## Utils API Reference

The `utils` object provides these functions:

| Function | Purpose |
|----------|---------|
| `addSuccessStep(fn)` | Register a validation function that runs on success |
| `addFailureStep(fn)` | Register a function that runs on failure (for recovery) |
| `success(value)` | Return a successful result |
| `failure(issue)` | Return a failure with single issue |
| `failure([issues])` | Return a failure with multiple issues |
| `createIssue(opts)` | Create a structured issue object |

### createIssue Options

```typescript
createIssue({
  code: 'step:issue_code',      // Unique identifier (step:snake_case)
  payload: { /* data */ },      // Issue-specific data for message/debugging
  customMessage: message,       // User-provided message override (from params)
  defaultMessage: 'text',       // Fallback message
})
```

## Issue Code Convention

Format: `[step-name]:[snake_case_description]`

Good examples:
- `string:expected_string`
- `number:expected_number`
- `min:expected_min`
- `email:invalid_format`
- `check:failed`

Bad examples:
- `STRING_ERROR` (wrong format)
- `invalidEmail` (missing step prefix)
- `min-error` (use underscores, not dashes)

## Testing Requirements

**100% code coverage is required for all step implementations.**

### Test File Template

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

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific step
pnpm test packages/internal/src/steps/step-name

# Run with coverage
pnpm test --coverage

# Watch mode
pnpm test --watch
```

## Benchmarks

Every step needs a benchmark file:

```typescript
// step-name.bench.ts
import { bench, describe } from 'vitest'
import { createValchecker, /* steps */ } from '../../../index'
import { stepName } from './step-name'

const v = createValchecker({ steps: [/* steps */] })

describe('stepName', () => {
  const schema = v./* chain */

  bench('valid input', () => {
    schema.run(validInput)
  })

  bench('invalid input', () => {
    schema.run(invalidInput)
  })
})
```

Run benchmarks:
```bash
pnpm bench
```

## Code Style Requirements

- **TypeScript strict mode** is enabled
- **Single quotes**, no semicolons
- **Tabs** for indentation
- **Functional patterns** preferred
- Use `/* @__NO_SIDE_EFFECTS__ */` annotation before exports for tree-shaking
- Follow existing patterns in `packages/internal/src/steps/`

## Common Step Patterns

### Constraint Step (No Type Change)

Steps that validate but don't change the type (like `min`, `max`, `minLength`):

```typescript
type Meta = DefineStepMethodMeta<{
  Name: 'positive'
  ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
  SelfIssue: ExecutionIssue<'positive:expected_positive', { value: number }>
}>

// In PluginDef: () => Next<{ issue: Meta['SelfIssue'] }, this['CurrentValchecker']>
```

### Transform Step (Type Changes)

Steps that modify the output type (like `toTrimmed`, `transform`):

```typescript
type Meta = DefineStepMethodMeta<{
  Name: 'toArray'
  ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
  SelfIssue: never  // Transforms typically don't fail
}>

// In PluginDef: () => Next<{ output: string[] }, this['CurrentValchecker']>
```

### Multi-Type Step

Steps that work with multiple input types (like `min` for number/bigint/length):

```typescript
// See packages/internal/src/steps/min/min.ts for complete example
```

### Recovery Step (Failure Handler)

Steps that catch failures (like `fallback`):

```typescript
addFailureStep((issues) => {
  return success(defaultValue)  // Recover from failure
})
```

## PR Checklist

Before submitting a PR:

1. **Run full verification:**
   ```bash
   pnpm lint && pnpm typecheck && pnpm test --coverage
   ```

2. **Ensure 100% coverage** for any modified/new steps

3. **Follow commit convention:**
   - `feat(step): add new step`
   - `fix(core): fix issue description`
   - `docs: update documentation`
   - `test: add tests`
   - `refactor: refactor description`

4. **Update exports** if adding new step:
   - Add to `packages/internal/src/steps/index.ts`

5. **Add JSDoc** with Description, Example, and Issues sections

## Quick Reference: Existing Steps

Browse existing implementations for reference:

| Category | Steps | Reference File |
|----------|-------|----------------|
| Primitives | `string`, `number`, `boolean`, `bigint`, `symbol` | `packages/internal/src/steps/string/` |
| Types | `literal`, `unknown`, `any`, `never`, `null_`, `undefined_` | `packages/internal/src/steps/literal/` |
| Structures | `object`, `strictObject`, `looseObject`, `array`, `union`, `intersection`, `instance` | `packages/internal/src/steps/object/` |
| Constraints | `min`, `max`, `empty`, `integer`, `startsWith`, `endsWith` | `packages/internal/src/steps/min/` |
| Transforms | `transform`, `toTrimmed`, `toLowercase`, `toUppercase`, `toFiltered`, `toSorted`, `toSliced`, `toLength`, `toSplitted`, `toString`, `parseJSON`, `stringifyJSON`, `toAsync` | `packages/internal/src/steps/toTrimmed/` |
| Flow Control | `check`, `fallback`, `use`, `as`, `generic` | `packages/internal/src/steps/check/` |
| Loose Variants | `looseNumber` | `packages/internal/src/steps/looseNumber/` |

## Troubleshooting

### Type Errors in Step Definition

1. Check `ExpectedCurrentValchecker` matches the required input type
2. Ensure `SelfIssue` code matches the code in `createIssue`
3. Verify `Next<>` generic parameters are correct

### Tests Failing

1. Run with `--verbose` to see detailed output
2. Check if issue codes match exactly (case-sensitive)
3. Verify `isOk` property exists in result before accessing `value` or `issues`

### Bundle Size Issues

1. Ensure `/* @__NO_SIDE_EFFECTS__ */` annotation is present
2. Check no side effects in module scope
3. Run `pnpm build` and check output size
