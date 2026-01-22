# Step Implementation Architecture

This document explains the three-layer pattern used by all validation steps in Valchecker.

## Overview

Every validation step follows a strict three-layer pattern:

1. **Meta** - Type metadata definition
2. **PluginDef** - TypeScript interface with JSDoc
3. **Implementation** - Runtime validation logic

## Layer 1: Meta (Type Metadata)

Defines the step's type information for TypeScript inference:

```typescript
type Meta = DefineStepMethodMeta<{
  Name: 'stepName'                              // Method name in chain
  ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: InputType }>  // Required input type
  SelfIssue: ExecutionIssue<'stepName:issue_code', { value: unknown }>  // Issue type
}>
```

**Key Points:**
- `Name`: The method name users will call (e.g., `'min'`, `'toTrimmed'`)
- `ExpectedCurrentValchecker`: What input type this step expects
- `SelfIssue`: The issue type this step can produce (or `never` for transforms)

## Layer 2: PluginDef (TypeScript Interface)

Defines the method signature with comprehensive JSDoc documentation:

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

**JSDoc Sections:**
- **Description**: What the step does
- **Example**: Code showing how to use it
- **Issues**: List of error codes this step can produce

## Layer 3: Implementation (Runtime Logic)

Implements the actual validation using `implStepPlugin`:

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

**Important Notes:**
- Always use `/* @__NO_SIDE_EFFECTS__ */` for tree-shaking
- Register validation with `addSuccessStep()` or `addFailureStep()`
- Use `success()` to pass values, `failure()` to report issues
- Return transformed values in `success()` for transform steps

## Common Patterns

### Constraint Step (No Type Change)

Steps that validate but don't change the type (like `min`, `max`):

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

### Recovery Step (Failure Handler)

Steps that catch failures (like `fallback`):

```typescript
addFailureStep((issues) => {
  return success(defaultValue)  // Recover from failure
})
```

### Multi-Type Step

Steps that work with multiple input types (like `min` for number/bigint/string.length):

See `packages/internal/src/steps/min/min.ts` for a complete example of handling multiple types.
