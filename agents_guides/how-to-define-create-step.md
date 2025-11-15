# How to Define a Step

This guide provides a comprehensive overview of how to define and implement a step plugin in the Valchecker framework. Steps are reusable validation or transformation units that form the building blocks of validation chains.

## Step Anatomy

A step is a modular unit that performs a specific validation or transformation. Every step is composed of three key parts, defined in the following order:

1.  **Metadata (`Meta`)**: Defines the step's name, its execution context (i.e., when it can be used in a chain), and the issue types it can produce.
2.  **Plugin Interface (`PluginDef`)**: Defines the step's method signature and JSDoc documentation as it appears on the validation chain.
3.  **Implementation (`implStepPlugin`)**: Contains the actual runtime logic for the step.

---

### 1. Metadata (`Meta`)

Define the step's metadata, which includes its name, expected execution context via the `ExpectedThis` property, and the issue types it can produce via the `SelfIssue` property. This determines when the step is available in the validation chain and what errors it can generate.

```typescript
type Meta = DefineStepMethodMeta<{
	// Step Method Name
	Name: 'stepMethodName'
	// Expected Valchecker Context
	ExpectedThis: DefineExpectedValchecker // Or a more specific type constraint
	// Self Issue (Optional - omit if the step never fails)
	SelfIssue: ExecutionIssue<'stepMethodName:error_code', { /* payload fields */ }>
}>
```

**`ExpectedThis` Examples:**

- **Any context (step always available)**:
	```typescript
	ExpectedThis: DefineExpectedValchecker
	```

- **Number-only constraint**:
	```typescript
	ExpectedThis: DefineExpectedValchecker<{ output: number }>
	// TypeScript hint: v.number().max(100) ✓ OK
	// TypeScript hint: v.string().max(100) ✗ Error
	```

- **String or Number union**:
	```typescript
	ExpectedThis: DefineExpectedValchecker<{ output: string | number }>
	```

- **Array-only constraint**:
	```typescript
	ExpectedThis: DefineExpectedValchecker<{ output: unknown[] }>
	```

- **Initial step (only at the start of a chain)**:
	```typescript
	ExpectedThis: DefineExpectedValchecker<{ initial: true }>
	// TypeScript hint: v.string() ✓ OK
	// TypeScript hint: v.string().string() ✗ Error
	```

**`SelfIssue` Definition:**

The `SelfIssue` property defines the issue types that the step can produce. Issues must follow the naming convention: `'stepMethodName:error_code'` (camelCase:snake_case). If your step has multiple possible failure modes, use a union of `ExecutionIssue` types.

```typescript
// Single issue type
SelfIssue: ExecutionIssue<'stepMethodName:error_code', { value: unknown }>

// Multiple issue types (union)
SelfIssue: 
	| ExecutionIssue<'stepMethodName:error_code_1', { value: unknown }>
	| ExecutionIssue<'stepMethodName:error_code_2', { value: unknown, reason: string }>
```

**Examples**:
- `'string:expected_string'`
- `'check:failed'`
- `'max:expected_max'`

**Note**: If your step never produces issues (e.g., a pure transformation step that always succeeds), you can omit the `SelfIssue` property entirely.

### 2. Plugin Interface (`PluginDef`)

Define a TypeScript interface extending `TStepPluginDef`. This interface describes the method signature and its JSDoc as it will appear on the validation chain.

> **Note**: The JSDoc for the method is critical for documentation and developer experience.

```typescript
interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * A concise summary of the step's purpose.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, stepMethodName } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [stepMethodName] })
	 * const schema = v.stepMethodName()
	 * const result = schema.execute(...)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'stepMethodName:error_code'`: Describes the condition that triggers this issue.
	 */
	stepMethodName: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			? (param1: Type1) => Next<{ output: OutputType, issue: Meta['SelfIssue'] }>
			: never
	>
}
```

**Key Points:**

- The interface must extend `TStepPluginDef`
- Use conditional type checking: `this['This'] extends Meta['ExpectedThis']` to ensure type safety
- The method should return `Next<Patch, this['This']>` where `Patch` specifies the output type and issue type
- Reference `Meta['SelfIssue']` for the issue type in the `Next<>` type
- For steps that work on any input (like initial type validators), add an additional constraint using `IsExactlyAnyOrUnknown<InferOutput<this['This']>>` to ensure they only work on unconstrained inputs

**Example for an initial type validator:**

```typescript
import type { IsExactlyAnyOrUnknown, InferOutput } from '../../core'

interface PluginDef extends TStepPluginDef {
	string: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			? IsExactlyAnyOrUnknown<InferOutput<this['This']>> extends true
				? (message?: MessageHandler<Meta['SelfIssue']>) => Next<
					{
						output: string
						issue: Meta['SelfIssue']
					},
					this['This']
				>
				: never
			: never
	>
}
```

### 3. Implementation

Export a `const` that implements the step's logic using `implStepPlugin()`. Add the `/* @__NO_SIDE_EFFECTS__ */` comment for tree-shaking optimization.

```typescript
/* @__NO_SIDE_EFFECTS__ */
export const stepMethodName = implStepPlugin<PluginDef>({
	stepMethodName: ({
		utils: { addSuccessStep, success, resolveMessage, failure },
		params: [param1, message],
	}) => {
		addSuccessStep((value) => {
			if (/* condition is met */) {
				return success(value)
			}
			return failure({
				code: 'stepMethodName:error_code',
				payload: { value, /* other fields */ },
				message: resolveMessage(
					{
						code: 'stepMethodName:error_code',
						payload: { value },
					},
					message,
					'Default error message.',
				),
			})
		})
	},
})
```

## Step Categories

- **Type Validation**: Checks if a value is of a specific type (e.g., `string`, `number`).
- **Constraint**: Applies constraints to a validated value (e.g., `max`, `min`).
- **Transformation**: Transforms the value (e.g., `transform`, `toString`).
- **Check**: Performs custom validation logic via a callback (e.g., `check`).
- **Structural**: Works with complex structures like objects and arrays (e.g., `object`, `array`).
- **Composition**: Combines other validators (e.g., `union`, `intersection`).
- **Fallback**: Handles validation failures gracefully (e.g., `fallback`).

## Utility Functions

All step implementations receive a `utils` object with these helpers:

| Utility | Purpose |
|---|---|
| `addSuccessStep(fn)` | Registers a handler for the success path. Takes a function that receives the current value and returns an `ExecutionResult`. |
| `addFailureStep(fn)` | Registers a handler for the failure path. Takes a function that receives an array of issues and returns an `ExecutionResult`. |
| `addStep(fn)` | Adds a runtime step directly. Takes a function that receives the last `ExecutionResult` and returns a new `ExecutionResult`. Used for composition. |
| `success(value)` | Returns a successful result from a step: `{ value }`. |
| `failure(issue)` | Returns a failure result from a step: `{ issues: [...] }`. Accepts a single issue or an array of issues. |
| `resolveMessage(issueContent, customMessage, defaultMessage)` | Resolves error messages in priority order: custom message → default message → global message → fallback ('Invalid value.'). |
| `isSuccess(result)` | Checks if an execution result is a success: `result is ExecutionSuccessResult<any>`. |
| `isFailure(result)` | Checks if an execution result is a failure: `result is ExecutionFailureResult<any>`. |
| `prependIssuePath(issue, path)` | Adds property/index information to an issue's path. Used for nested validations (objects, arrays). |
| `issue(content)` | Returns the issue content as-is. Utility for creating issue objects. |

## Advanced Patterns

### Handling Method Overloads

When creating a step that delegates to a native method with multiple function overloads (e.g., `String.prototype.split`), use the `OverloadParametersAndReturnType<T>` utility to correctly type the step.

```typescript
// Extracts all overloads from a function type as a union of [params, returnType] tuples.
OverloadParametersAndReturnType<typeof String.prototype.split>
```

This allows your step to accept any valid parameter combination and infers the correct return type.

### Optional Properties in Objects

To define an optional property in `object`, `looseObject`, or `strictObject` schemas, wrap its validator in a single-element array.

```typescript
const schema = v.object({
	requiredProp: v.string(),
	optionalProp: [v.string()], // This property is now optional
})
```

## Error Handling and Exceptions

The Valchecker framework automatically wraps all step execution in error handling. If a step throws an unexpected exception, it will be automatically converted to a `core:unknown_exception` issue:

```typescript
{
	code: 'core:unknown_exception',
	payload: { method: 'stepName', value: lastResult, error: thrownError },
	message: 'An unexpected error occurred during step execution'
}
```

However, for user-provided callbacks (e.g., in `transform`, `check`, `fallback`), you should handle errors explicitly and convert them to appropriate failure results:

```typescript
addSuccessStep((value) => {
	const handleError = (error: unknown) => {
		return failure({
			code: 'stepName:failed',
			payload: { value, error },
			message: resolveMessage(
				{ code: 'stepName:failed', payload: { value, error } },
				message,
				'Operation failed',
			),
		})
	}
	
	try {
		const result = userProvidedCallback(value)
		return result instanceof Promise
			? result.then(res => success(res)).catch(err => handleError(err))
			: success(result)
	}
	catch (error) {
		return handleError(error)
	}
})
```

## Implementation Checklist

Follow this checklist to ensure your step is correctly implemented:

- [ ] **Unique ID**: The step's `Name` in its metadata is unique.
- [ ] **Error Codes**: All `ExecutionIssue` codes in `SelfIssue` follow the format `'stepName:errorCode'` (camelCase:snake_case).
- [ ] **JSDoc**: The method in the `PluginDef` interface has a complete JSDoc, including `Description`, `Example`, and `Issues` sections.
- [ ] **Type Safety**: `ExpectedThis` correctly constrains the step's context.
- [ ] **Meta Reference**: The `Next<>` type references `Meta['SelfIssue']` for the issue type.
- [ ] **Error Handling**: Errors from user-provided callbacks are caught with `try...catch` and converted to a `failure` result.
- [ ] **Async Support**: Asynchronous operations are detected (e.g., `instanceof Promise`) and handled correctly with `.then()` and `.catch()`.
- [ ] **Message Resolution**: All error messages use `resolveMessage()` to support custom, default, and global messages.
- [ ] **Tree-Shaking**: The export includes the `/* @__NO_SIDE_EFFECTS__ */` comment.
- [ ] **File Organization**: The step is in its own file (`/steps/stepName/stepName.ts`) and exported from `/steps/index.ts`.
- [ ] **Tests**: Comprehensive tests are written following [How to Test a Step](./how-to-test-a-step.md).
- [ ] **Benchmarks**: Performance benchmarks are created following [How to Create a Benchmark](./how-to-create-benchmark.md).

> **Note**: Each step file should contain only one step method. This means each plugin will register only one method on the validation chain.

## Development Workflow

The recommended workflow for creating a step is:

1. **Define the step** following this guide
2. **Write comprehensive tests** following [How to Test a Step](./how-to-test-a-step.md)
3. **Create performance benchmarks** following [How to Create a Benchmark](./how-to-create-benchmark.md)
4. **Run verification**:
   ```bash
   pnpm lint      # Ensure code style compliance
   pnpm typecheck # Verify TypeScript types
   pnpm test      # Ensure all tests pass
   pnpm bench     # Measure performance
   ```
5. **Review and iterate** based on test results and benchmark performance