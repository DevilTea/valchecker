# Plugin System Architecture

## Overview

Valchecker uses a **proxy-based plugin system** to enable composable validation steps. The system provides:

- Type-safe step composition
- Automatic type inference through the pipeline
- Runtime validation of step plugins
- Efficient proxy interception for method dispatch

## Core Concepts

### 1. Plugin Definition

A plugin is marked with `implStepPlugin()`:

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

**Key Points**:
- `implStepPlugin()` marks the function as a step plugin
- Generic type parameter specifies the valchecker type it expects
- `CurrentValchecker` is the type this step receives
- Returns a new step function

### 2. Plugin Registration

Plugins are registered when creating a valchecker instance:

```typescript
const v = createValchecker({
  steps: [stringStep, numberStep, arrayStep],
  message: customMessageHandler // Optional
})
```

**Process**:
1. Agent passes array of step plugins
2. `createValchecker()` creates a proxy handler
3. Each step is validated at runtime
4. Proxy becomes the validator instance

### 3. Proxy-Based Dispatch

When you call a method on the valchecker instance:

```typescript
const schema = v.string()     // Method call on proxy
```

**Execution**:
1. Proxy intercepts `string` property access
2. Finds matching step plugin
3. Creates and returns step instance
4. Step instance is itself a proxy for chaining

### 4. Type Evolution

Each step changes the type:

```
InitialValchecker
  ↓ .string()
Valchecker<string>
  ↓ .toUppercase()
Valchecker<string>
  ↓ .min(5)
Valchecker<string>
  ↓ .transform(...)
Valchecker<string>  (transformed)
```

The type system tracks how the current type evolves through the pipeline.

## Internal Mechanics

### Step Plugin Interface

```typescript
interface StepPluginImpl {
  // Called when creating valchecker instance
  (params: {
    createStep: (def: StepDefinition) => StepMethod
    expected: ExpectedValchecker
    utils: StepMethodUtils
  }): StepMethod
}
```

### Step Definition

```typescript
interface StepDefinition {
  name: string
  expected: ExpectedValchecker
  step: (
    value: unknown,
    issue: ExecutionIssue
  ) => StepExecutionResult
}
```

### Execution Result

```typescript
type StepExecutionResult = 
  | { value: unknown }
  | { issue: ExecutionIssue }
```

### Runtime Markers

Steps are marked with a symbol for identification:

```typescript
const runtimeExecutionStepDefMarker = Symbol('RES_MARKER')

export function implStepPlugin(fn: StepPluginImpl) {
  fn[runtimeExecutionStepDefMarker] = true
  return fn
}

// Later: identify valid plugins
if (fn[runtimeExecutionStepDefMarker]) {
  // This is a valid step plugin
}
```

## Pipeline Execution

### Pipeline Executor

The `createPipeExecutor()` function is performance-critical:

```typescript
export function createPipeExecutor({
  runtimeSteps,
}: {
  runtimeSteps: ((lastResult: ExecutionResult) => MaybePromise<ExecutionResult>)[]
}): (value: unknown) => MaybePromise<ExecutionResult> {
  return (value: unknown) => {
    // Optimized: Direct execution without Pipe overhead
    const len = runtimeSteps.length
    let result: any = { value }
    let isAsync = false

    for (let i = 0; i < len; i++) {
      if (isAsync) continue // Skip if async mode

      result = runtimeSteps[i]!(result)

      // Detect async (Promise)
      if (result instanceof Promise) {
        isAsync = true
      }
    }

    // Once async, continue with Promise chain
    if (isAsync) {
      // Promise handling logic
    }

    return result
  }
}
```

**Optimizations**:
- Pre-computed step executors
- Direct loop without overhead
- Promise detection for async switch
- Skip sync processing once async starts

## Type System Integration

### Type Tracking

The system uses TypeScript's type system to track:

```typescript
interface TValchecker {
  '~core': {
    executionStepContext: TExecutionContext
    registeredExecutionStepPlugins: TStepPluginDef
  }
}
```

This enables:
- Method availability based on current type
- Output type inference for schemas
- Issue type inference for errors

### Expected Type Resolution

Each step specifies what type it expects:

```typescript
type ExpectedCurrentValchecker<T> = {
  // Specific type requirements
}

function expected() {
  // Validates at runtime that the current type matches
}
```

## Error Handling in Pipeline

### Issue Propagation

When a step fails, the issue propagates:

```typescript
step(value, issue) {
  if (previousStepFailed) {
    return { issue }  // Pass through
  }
  
  // Process current step
  if (currentStepFails) {
    return {
      issue: {
        code: 'step:error',
        message: 'Error message',
        path: [],
        payload: {}
      }
    }
  }
  
  return { value }
}
```

### Path Tracking

For nested structures, paths are tracked:

```typescript
function prependIssuePath(
  issue: ExecutionIssue,
  path: PropertyKey[]
): ExecutionIssue {
  // Prepends path to issue.path
  // Used for nested validation errors
}
```

Example:
- Array item error at index 0 → path: [0]
- Object property error → path: ['field']
- Nested error → path: ['user', 'email']

## Message System

### Message Handling

Messages can be customized globally or per-step:

```typescript
const v = createValchecker({
  steps: allSteps,
  message({ code, payload }) {
    if (code === 'string:expected_string') {
      return `Expected string but got ${typeof payload.value}`
    }
    return 'Validation failed'
  }
})
```

### Message Resolution

Process:
1. Step emits error code
2. Message handler is called
3. Handler returns custom message
4. Message is placed in ExecutionIssue

## Advanced Features

### Composition

Steps can compose other schemas:

```typescript
export const use = implStepPlugin<{
  CurrentValchecker: Valchecker
}>(({ createStep, expected }) => {
  return createStep({
    name: 'use',
    expected,
    step(value, issue, { delegateSchema }) {
      // Execute delegated schema
      return delegateSchema.execute(value)
    }
  })
})
```

### Async Support

Steps naturally support async:

```typescript
step(value, issue) {
  return {
    value: asyncOperation().then(result => transformResult(result))
  }
}
```

The pipeline automatically detects Promises and handles async execution.

### Type Guards

Steps can narrow types:

```typescript
export const check = implStepPlugin<{
  CurrentValchecker: Valchecker
}>(({ createStep, expected }) => {
  return createStep({
    name: 'check',
    expected,
    step(value, issue) {
      if (predicate(value)) {
        return { value }
      }
      return { issue: createIssue(...) }
    }
  })
})
```

## Plugin Lifecycle

1. **Definition**: Plugin defined with `implStepPlugin()`
2. **Registration**: Plugin passed to `createValchecker()`
3. **Validation**: Runtime check that plugin has marker
4. **Invocation**: Plugin called with params
5. **Step Creation**: Step function created
6. **Method Binding**: Step bound to proxy
7. **Execution**: Schema.execute() calls pipeline executor

## Performance Considerations

### Hot Path Optimization

The pipeline executor is optimized for:
- Minimal object allocation
- Loop-based execution
- Early Promise detection
- Pre-computed branch executors (union/intersection)

### Step Complexity

Each step should:
- Minimize work in hot path
- Use benchmarks to track performance
- Avoid unnecessary allocations
- Fail fast on type mismatch

## Debugging Plugins

### Type Checking

Verify plugin is registered correctly:
```bash
pnpm typecheck
```

### Runtime Validation

Plugins must:
- Have the runtime marker
- Return valid step function
- Implement step(value, issue) correctly

### Testing

Each plugin needs:
- Unit tests for functionality
- Bench tests for performance
- Edge case coverage

---

See STEP_IMPLEMENTATION.md for creating new plugins.
