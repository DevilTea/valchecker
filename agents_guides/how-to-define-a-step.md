# How to Define a Step

This guide explains how to define and implement a single Valchecker step ("step plugin"). A step is the smallest reusable validation or transformation unit in a chain. Each step must be implemented in isolation and registered exactly once.

## Overview

Every step definition consists of three ordered parts:
1. Metadata (`Meta`) – declares the step's identity, availability context, and issue types.
2. Plugin Interface (`PluginDef`) – exposes the chain method with full JSDoc and conditional availability.
3. Implementation (`implStepPlugin`) – runtime logic wired through utilities.

---

## 1. Metadata (`Meta`)

Use `DefineStepMethodMeta<...>` to declare:
- `Name`: Unique chain method name in `camelCase`.
- `ExpectedThis`: Context constraint declaring when the method is callable.
- `SelfIssue` (optional): Issue type(s) the step can emit. Omit if the step never fails.

```typescript
type Meta = DefineStepMethodMeta<{
	Name: 'stepMethodName'
	ExpectedThis: DefineExpectedValchecker // Or a narrowed constraint e.g. DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'stepMethodName:error_code', { value: unknown }>
}>
```

### ExpectedThis Patterns
| Goal | Example |
|------|---------|
| Always available | `DefineExpectedValchecker` |
| Constrain output type | `DefineExpectedValchecker<{ output: number }>` |
| Initial-only (first link) | `DefineExpectedValchecker<{ initial: true }>` |
| Union constraint | `DefineExpectedValchecker<{ output: string | number }>` |
| Array-only | `DefineExpectedValchecker<{ output: unknown[] }>` |

### SelfIssue Patterns
Issue codes must follow: `stepName:error_code` (camelCase:snake_case).

```typescript
SelfIssue: ExecutionIssue<'stepMethodName:error_code', { value: unknown }>
// Multiple failure modes
SelfIssue:
	| ExecutionIssue<'stepMethodName:error_code_a', { value: unknown }>
	| ExecutionIssue<'stepMethodName:error_code_b', { value: unknown; reason: string }>
```

If the step cannot fail (pure transformation) omit `SelfIssue`.

---

## 2. Plugin Interface (`PluginDef`)

Define a TypeScript interface extending `TStepPluginDef`. Gate availability via conditional types comparing `this['This']` against `Meta['ExpectedThis']`. For initial validators add `IsExactlyAnyOrUnknown<InferOutput<this['This']>>` to restrict invocation to unconstrained chains.

```typescript
interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description
	 * Brief purpose sentence.
	 *
	 * ### Example
	 * ```ts
	 * import { createValchecker, stepMethodName } from 'valchecker'
	 * const v = createValchecker({ steps: [stepMethodName] })
	 * const schema = v.stepMethodName(/* params */)
	 * const result = schema.execute(input)
	 * ```
	 *
	 * ### Issues
	 * - `stepMethodName:error_code` – describe trigger condition
	 */
	stepMethodName: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			? (param1: Type1) => Next<
					{ output: OutputType; issue: Meta['SelfIssue'] },
					this['This']
				>
			: never
	>
}
```

### Initial Validator Example
```typescript
interface StringPluginDef extends TStepPluginDef {
	string: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			? IsExactlyAnyOrUnknown<InferOutput<this['This']>> extends true
				? (message?: MessageHandler<Meta['SelfIssue']>) => Next<{
					output: string
					issue: Meta['SelfIssue']
				}, this['This']>
				: never
			: never
	>
}
```

Key Points:
- Extend `TStepPluginDef`.
- Always wrap the callable signature inside the conditional block.
- Return `Next<{ output; issue }, this['This']>` referencing `Meta['SelfIssue']`.
- Keep JSDoc exhaustive (Description / Example / Issues).

---

## 3. Implementation (`implStepPlugin`)

Export a constant with the `/* @__NO_SIDE_EFFECTS__ */` annotation for better tree-shaking.

```typescript
/* @__NO_SIDE_EFFECTS__ */
export const stepMethodName = implStepPlugin<PluginDef>({
	stepMethodName: ({
		utils: { addSuccessStep, success, failure, createIssue },
		params: [param1, message],
	}) => {
		addSuccessStep((value) => {
			if (/* pass condition */) return success(value)
			return failure(
				createIssue({
					code: 'stepMethodName:error_code',
					payload: { value, param1 },
					customMessage: message,
					defaultMessage: 'Default error message.',
				}),
			)
		})
	},
})
```

For user callback steps (`transform`, `check`, `fallback`) wrap callback execution in `try/catch` and branch on Promises:

```typescript
addSuccessStep((value) => {
	const handleError = (error: unknown) => {
		return failure(
			createIssue({
				code: 'stepMethodName:failed',
				payload: { value, error },
				customMessage: message,
				defaultMessage: 'Operation failed',
			}),
		)
	}
	try {
		const out = userCallback(value)
		return out instanceof Promise
			? out.then(r => success(r)).catch(handleError)
			: success(out)
	} catch (err) {
		return handleError(err)
	}
})
```

---

## Utilities Summary
| Utility | Purpose |
|---------|---------|
| `addSuccessStep(fn)` | Register success-path transformation/validation. |
| `addFailureStep(fn)` | Register failure-path handler (e.g., `fallback`). |
| `addStep(fn)` | Raw access for composition steps. |
| `success(value)` | Produce success result. |
| `failure(issue|issues)` | Produce failure result. |
| `createIssue(content)` | Create an issue with message resolution (code, payload, customMessage, defaultMessage). |
| `isSuccess(result)` | Type guard for success. |
| `isFailure(result)` | Type guard for failure. |
| `prependIssuePath(issue, path)` | Augment issue path for nested validations. |
| `issue(content)` | Identity helper for issue content. |

---

## Categories (Classification)
| Category | Description | Examples |
|----------|-------------|----------|
| Type Validation | Establish base type | `string`, `number`, `object` |
| Constraint | Enforce limits/conditions | `max`, `min`, `integer` |
| Transformation | Convert value shape | `transform`, `toFiltered` |
| Check | Custom predicate logic | `check` |
| Structural | Nested structure handling | `array`, `strictObject` |
| Composition | Combine schemas | `intersection`, `union` |
| Fallback | Recovery on failure | `fallback` |

---

## Error Handling
Internal execution exceptions are converted to a `core:unknown_exception` issue automatically. Only wrap user-provided callbacks explicitly.

---

## Implementation Checklist
- [ ] Unique `Name`.
- [ ] Issue codes follow `stepName:snake_case` format.
- [ ] `ExpectedThis` correctly constrains context.
- [ ] Pure transformations omit `SelfIssue`.
- [ ] JSDoc includes Description / Example / Issues.
- [ ] Conditional availability uses `this['This'] extends Meta['ExpectedThis']`.
- [ ] Initial validators gate with `IsExactlyAnyOrUnknown`.
- [ ] All failure paths use `createIssue` with customMessage and defaultMessage.
- [ ] Async paths handle Promise resolution/rejection.
- [ ] Export annotated with `/* @__NO_SIDE_EFFECTS__ */`.
- [ ] File located at `packages/valchecker/src/steps/<name>/<name>.ts`.
- [ ] Exported via `packages/valchecker/src/steps/index.ts`.
- [ ] Test file exists with 100% coverage.
- [ ] Benchmark file exists measuring valid / invalid / baseline scenarios.

---

## Development Flow
1. Define `Meta`, `PluginDef`, implementation.
2. Write tests (see `how-to-test-a-step.md`).
3. Write benchmark (see `how-to-write-a-benchmark.md`).
4. Run verification:
```bash
pnpm -w lint
pnpm -w typecheck
pnpm -w test --coverage.include=packages/valchecker/src/steps/<name>/<name>.ts packages/valchecker/src/steps/<name>/<name>.test.ts
pnpm -w bench
```
5. Review against this checklist.

---

## Cross References
- Testing a step: `how-to-test-a-step.md`
- Benchmarking: `how-to-write-a-benchmark.md`
- Proofreading step code: `how-to-proofread-a-step.md`
- Proofreading step tests: `how-to-proofread-a-test-for-step.md`
