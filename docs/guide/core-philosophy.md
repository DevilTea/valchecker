# Core Philosophy

Valchecker is built around modular "steps" that execute in a deterministic pipeline. Each step validates, transforms, or short-circuits data while preserving TypeScript inference. This guide explains the mental model so you can design reliable validation flows and extend the library confidently.

## Everything is a Step

- A **step** is a small plugin function that receives the current execution state and returns either a success result or validation issues.
- Steps are composed through helper factories like `string()`, `number()`, `array()`, or authored manually using `implStepPlugin()` from `@valchecker/internal`.
- Because steps are plain functions, you can reuse them across CLI tools, API handlers, background jobs, or any runtime surface.

```ts
// Using built-in steps
const schema = v.string()
	.toTrimmed()
	.min(3)

// Steps chain together to form a pipeline
```

## The Pipeline Contract

1. **Schema Creation**: Chain steps together. Complex structures like `object`, `array`, `union`, and `intersection` orchestrate nested pipelines internally.

2. **Execution**: Calling `schema.execute(value)` returns a discriminated union:
   - Success: `{ value: T }` where `T` is the inferred output type
   - Failure: `{ issues: ExecutionIssue[] }` with structured error information

3. **Issue Structure**: Each issue includes:
   - `code`: Identifier like `'string:expected_string'` or `'check:failed'`
   - `message`: Human-readable error description
   - `path`: Array describing the location in nested data (e.g., `['user', 'email']`)
   - `payload`: Raw metadata about the failure

4. **Async Detection**: Pipelines automatically switch to async mode when any step returns a `Promise`. Mix sync and async steps freely.

```ts
const pipeline = v.string()
	.toTrimmed()
	.check(value => value.length > 0, 'String cannot be empty')
	.transform(value => value.toUpperCase())

const result = await pipeline.execute('  hello  ')
// => { value: 'HELLO' }
```

## Message Resolution Priority

Error messages are resolved in the following order:

1. **Per-step override**: Passed directly to the step
	```ts
	v.number()
		.min(1, 'Quantity must be at least 1')
	```

2. **Global handler**: Defined when creating the valchecker instance
	```ts
	const v = createValchecker({
		steps: allSteps,
		message: ({ code, payload }) => translate(code, payload),
	})
	```

3. **Built-in fallback**: Default message from the step implementation

This allows you to centralize translations while still overriding specific cases.

## Paths and Traceability

- Each issue carries a `path` array showing how to reach the failing value
- Structural steps (`object`, `array`) automatically append keys or indexes
- Custom steps should append path segments when descending into nested data

```ts
const schema = v.object({
	user: v.object({
		email: v.string(),
	}),
})

const result = schema.execute({ user: { email: 123 } })
// result.issues[0].path === ['user', 'email']
```

This makes it trivial to highlight the exact field in forms or API responses.

## Extending Valchecker

To create custom validation steps, use `implStepPlugin()` following the pattern from existing steps:

```ts
import type { DefineStepMethod, DefineStepMethodMeta, TStepPluginDef } from '@valchecker/internal'
import { implStepPlugin } from '@valchecker/internal'

// 1. Define metadata
type Meta = DefineStepMethodMeta<{
	Name: 'positiveNumber'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
	SelfIssue: ExecutionIssue<'positiveNumber:not_positive', { value: number }>
}>

// 2. Define plugin interface
interface PluginDef extends TStepPluginDef {
	positiveNumber: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? () => Next<{ output: number, issue: Meta['SelfIssue'] }, this['CurrentValchecker']>
			: never
	>
}

// 3. Implement the step
export const positiveNumber = implStepPlugin<PluginDef>({
	positiveNumber: ({ utils: { addSuccessStep, success, failure, resolveMessage } }) => {
		addSuccessStep((value) => {
			if (value > 0) {
				return success(value)
			}

			return failure({
				code: 'positiveNumber:not_positive',
				payload: { value },
				message: resolveMessage(
					{ code: 'positiveNumber:not_positive', payload: { value } },
					null,
					'Value must be positive',
				),
			})
		})
	},
})
```

See `packages/internal/src/steps/` for complete examples of primitive, structural, and transformation steps.

## Testing Requirements

- Every step `.ts` file must have a sibling `.test.ts` with 100% code coverage
- Tests use Vitest and should cover success paths, failure paths, async variants, and edge cases
- Run the full verification sequence after changes:
  ```bash
  pnpm -w lint
  pnpm -w typecheck
  pnpm -w test
  ```

## Production Best Practices

- **Selective imports**: Use tree-shaking in production to exclude unused steps
- **Schema reuse**: Define schemas once and reuse them—avoid recreating inside hot paths
- **Observability**: Capture `issues` in monitoring tools—they contain structured codes for dashboards
- **Documentation**: Document custom steps so consumers understand configuration and failure modes

## Design Principles

1. **Deterministic**: Same input always produces the same result
2. **Composable**: Steps combine without special handling
3. **Type-safe**: Full inference through transforms and checks
4. **Extensible**: Add custom steps without modifying core
5. **Debuggable**: Structured issues enable precise error reporting
