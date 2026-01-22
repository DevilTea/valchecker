# Implementation Examples

Reference implementations for common step patterns.

## Complete Constraint Step Example

Here's a complete example of a constraint step that doesn't change the type:

```typescript
// positive.ts
import { DefineExpectedValchecker, DefineStepMethodMeta, ExecutionIssue, 
         TStepPluginDef, DefineStepMethod, Next, MessageHandler, 
         implStepPlugin } from '@valchecker/internal'

type Meta = DefineStepMethodMeta<{
  Name: 'positive'
  ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
  SelfIssue: ExecutionIssue<'positive:expected_positive', { value: number }>
}>

interface PluginDef extends TStepPluginDef {
  /**
   * ### Description:
   * Validates that the number is positive (greater than zero).
   *
   * ---
   *
   * ### Example:
   * ```ts
   * const v = createValchecker({ steps: [number, positive] })
   * const schema = v.number().positive()
   * schema.run(5) // { value: 5 }
   * schema.run(-5) // { issues: [...] }
   * ```
   *
   * ---
   *
   * ### Issues:
   * - `'positive:expected_positive'`: The number is not positive.
   */
  positive: DefineStepMethod<
    Meta,
    this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
      ? (message?: MessageHandler<Meta['SelfIssue']>) => Next<
          { issue: Meta['SelfIssue'] },
          this['CurrentValchecker']
        >
      : never
  >
}

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

## Complete Transform Step Example

Here's a transform step that changes the output type:

```typescript
// toPositive.ts - Converts negative numbers to positive

import { DefineExpectedValchecker, DefineStepMethodMeta, TStepPluginDef, 
         DefineStepMethod, Next, implStepPlugin } from '@valchecker/internal'

type Meta = DefineStepMethodMeta<{
  Name: 'toPositive'
  ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
  SelfIssue: never  // Transforms don't fail
}>

interface PluginDef extends TStepPluginDef {
  /**
   * ### Description:
   * Transforms a number to its absolute value (always positive).
   *
   * ---
   *
   * ### Example:
   * ```ts
   * const v = createValchecker({ steps: [number, toPositive] })
   * const schema = v.number().toPositive()
   * schema.run(-5) // { value: 5 }
   * schema.run(5) // { value: 5 }
   * ```
   *
   * ---
   *
   * ### Issues:
   * - None - this transform never fails.
   */
  toPositive: DefineStepMethod<
    Meta,
    this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
      ? () => Next<
          { output: number },
          this['CurrentValchecker']
        >
      : never
  >
}

/* @__NO_SIDE_EFFECTS__ */
export const toPositive = implStepPlugin<PluginDef>({
  toPositive: ({
    utils: { addSuccessStep, success },
  }) => {
    addSuccessStep((value) => {
      return success(Math.abs(value))
    })
  },
})
```

## Recovery/Fallback Step Example

Here's a step that catches failures and provides a default:

```typescript
// defaultTo.ts - Provides a default value on failure

import { DefineExpectedValchecker, DefineStepMethodMeta, TStepPluginDef, 
         DefineStepMethod, Next, implStepPlugin } from '@valchecker/internal'

type Meta = DefineStepMethodMeta<{
  Name: 'defaultTo'
  ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: unknown }>
  SelfIssue: never
}>

interface PluginDef extends TStepPluginDef {
  /**
   * ### Description:
   * Provides a default value if validation fails.
   *
   * ---
   *
   * ### Example:
   * ```ts
   * const schema = v.number().min(0).defaultTo(0)
   * schema.run(-5) // { value: 0 }
   * schema.run(5) // { value: 5 }
   * ```
   *
   * ---
   *
   * ### Issues:
   * - None - failures are recovered.
   */
  defaultTo: DefineStepMethod<
    Meta,
    this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
      ? (defaultValue: this['CurrentValchecker']['output']) => Next<
          { output: this['CurrentValchecker']['output'] },
          this['CurrentValchecker']
        >
      : never
  >
}

/* @__NO_SIDE_EFFECTS__ */
export const defaultTo = implStepPlugin<PluginDef>({
  defaultTo: ({
    utils: { addFailureStep, success },
    params: [defaultValue],
  }) => {
    addFailureStep(() => {
      return success(defaultValue)
    })
  },
})
```

## Multi-Type Constraint Example

Here's a constraint that works with multiple input types:

```typescript
// hasLength.ts - Works with strings, arrays, etc.

import { DefineExpectedValchecker, DefineStepMethodMeta, ExecutionIssue,
         TStepPluginDef, DefineStepMethod, Next, MessageHandler, 
         implStepPlugin } from '@valchecker/internal'

type HasLength = string | { length: number }

type Meta = DefineStepMethodMeta<{
  Name: 'hasLength'
  ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: HasLength }>
  SelfIssue: ExecutionIssue<'hasLength:expected_length', { 
    value: HasLength
    length: number
  }>
}>

interface PluginDef extends TStepPluginDef {
  /**
   * ### Description:
   * Validates that value has a specific length (works with strings and arrays).
   *
   * ---
   *
   * ### Example:
   * ```ts
   * const schema = v.string().hasLength(5)
   * schema.run('hello') // { value: 'hello' }
   * schema.run('hi') // { issues: [...] }
   * ```
   *
   * ---
   *
   * ### Issues:
   * - `'hasLength:expected_length'`: Length doesn't match required value.
   */
  hasLength: DefineStepMethod<
    Meta,
    this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
      ? (length: number, message?: MessageHandler<Meta['SelfIssue']>) => Next<
          { issue: Meta['SelfIssue'] },
          this['CurrentValchecker']
        >
      : never
  >
}

/* @__NO_SIDE_EFFECTS__ */
export const hasLength = implStepPlugin<PluginDef>({
  hasLength: ({
    utils: { addSuccessStep, success, createIssue, failure },
    params: [requiredLength, message],
  }) => {
    addSuccessStep((value) => {
      if (value.length === requiredLength) {
        return success(value)
      }
      return failure(
        createIssue({
          code: 'hasLength:expected_length',
          payload: { value, length: requiredLength },
          customMessage: message,
          defaultMessage: `Expected length of ${requiredLength}, got ${value.length}`,
        }),
      )
    })
  },
})
```

## Key Patterns

1. **Constraint steps**: Return same type in `Next<{ issue }>`
2. **Transform steps**: Return new type in `Next<{ output: NewType }>`
3. **Recovery steps**: Use `addFailureStep` instead of `addSuccessStep`
4. **Multi-type steps**: Use union types in `ExpectedCurrentValchecker`
5. **Always include**: Tree-shaking annotation, JSDoc, issue payload

## Testing These Examples

Each example should be tested with:
- Valid inputs
- Invalid inputs
- Custom messages
- Chaining with other steps
- Edge cases specific to the step

See [testing guide](./testing.md) for complete testing details.
