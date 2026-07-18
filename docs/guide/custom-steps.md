# Custom Steps

Custom step plugins extend Valchecker's state-aware fluent API while preserving runtime behavior, output inference, issue types, and tree-shaking.

Use a custom plugin when a domain operation is reused broadly or deserves a discoverable named API. For one-off logic, prefer the generic `check()` or `transform()` escape hatches.

## Naming a custom step

Follow the same conventions as built-ins when they fit:

- initial schemas use nouns or noun phrases,
- validations use natural `isXxx` boolean propositions,
- concrete transformations use `toXxx`,
- generic or flow-control operations use the most direct verb.

For example, a positive-number validation should be `isPositive()`, not `positive()`.

Issue codes use the public step name:

```text
isPositive:expected_positive
```

`ExecutionIssue<'code', Payload>` defaults to the `validation` category. Use the third generic only when the failure is operational or internal:

```ts
type CallbackIssue = ExecutionIssue<
	'toDomain:callback_failed',
	{ value: Input, error: unknown },
	'operation'
>
```

Every runtime issue created by `createIssue()` receives the declared category. Its `code`, `payload`, and non-default `category` are checked against `Meta.SelfIssue` at compile time.

## Use `check()` first

```ts
const positive = v.number().check(value => value > 0, { message: 'Expected a positive number' }
)
```

Create a plugin when the operation needs reusable parameters, typed issue payloads, optimized runtime logic, or first-class editor discovery.

## Plugin architecture

A built-in-style plugin has three layers:

1. `Meta` defines the public method name, valid current schema state, and self issue.
2. `PluginDef` defines the state-aware TypeScript method signature.
3. `implStepPlugin()` registers runtime behavior.

## Validation plugin example

The following plugin adds `isPositive()` only after the pipeline output is a number.

```ts
import type {
	DefineExpectedValchecker,
	DefineStepMethod,
	DefineStepMethodMeta,
	ExecutionIssue,
	MessageHandler,
	Next,
	TStepPluginDef,
} from '@valchecker/internal'
import { implStepPlugin } from '@valchecker/internal'

type Meta = DefineStepMethodMeta<{
	Name: 'isPositive'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
	SelfIssue: ExecutionIssue<
		'isPositive:expected_positive',
		{ value: number }
	>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Checks that the number is greater than zero.
	 *
	 * Issue: `isPositive:expected_positive`
	 */
	isPositive: DefineStepMethod<
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
export const isPositive = implStepPlugin<PluginDef>({
	isPositive: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep(value => value > 0
			? success(value)
			: failure(
					createIssue({
						code: 'isPositive:expected_positive',
						payload: { value },
						customMessage: message,
						defaultMessage: 'Expected a positive number.',
					}),
				))
	},
})
```

Register and use it selectively:

```ts
import { createValchecker, number } from 'valchecker'
import { isPositive } from './isPositive'

const v = createValchecker({
	steps: [number, isPositive],
})

v.number().isPositive().execute(5) // { value: 5 }
v.number().isPositive().execute(0) // failure
```

## Parameters and typed payloads

A parameterized validation should expose the parameter in its issue payload:

```ts
type Meta = DefineStepMethodMeta<{
	Name: 'isMultipleOf'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
	SelfIssue: ExecutionIssue<
		'isMultipleOf:expected_multiple',
		{ value: number, divisor: number }
	>
}>

interface PluginDef extends TStepPluginDef {
	isMultipleOf: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (
				divisor: number,
				message?: MessageHandler<Meta['SelfIssue']>,
			) => Next<
				{ issue: Meta['SelfIssue'] },
				this['CurrentValchecker']
			>
			: never
	>
}
```

Runtime implementation. `createIssue()` is constrained by this plugin's `Meta.SelfIssue`, so misspelled codes and incompatible payloads are compile errors:

```ts
/* @__NO_SIDE_EFFECTS__ */
export const isMultipleOf = implStepPlugin<PluginDef>({
	isMultipleOf: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [divisor, message],
	}) => {
		addSuccessStep(value => value % divisor === 0
			? success(value)
			: failure(
					createIssue({
						code: 'isMultipleOf:expected_multiple',
						payload: { value, divisor },
						customMessage: message,
						defaultMessage: `Expected a multiple of ${divisor}.`,
					}),
				))
	},
})
```

## Transformation plugin example

A concrete transformation changes the output type and uses a `toXxx` name:

```ts
import type {
	DefineExpectedValchecker,
	DefineStepMethod,
	DefineStepMethodMeta,
	Next,
	TStepPluginDef,
} from '@valchecker/internal'
import { implStepPlugin } from '@valchecker/internal'

type Meta = DefineStepMethodMeta<{
	Name: 'toCodePoints'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
}>

interface PluginDef extends TStepPluginDef {
	toCodePoints: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? () => Next<
				{ output: number[] },
				this['CurrentValchecker']
			>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toCodePoints = implStepPlugin<PluginDef>({
	toCodePoints: ({ utils: { addSuccessStep, success } }) => {
		addSuccessStep(value =>
			success([...value].map(character => character.codePointAt(0)!)),
		)
	},
})
```

The next available methods are inferred from `number[]`, not `string`.

## Initial schema plugins

An initial plugin is available only while the current output is still `any` or `unknown`. Built-in primitive steps use `IsExactlyAnyOrUnknown<InferOutput<...>>` to enforce this state.

Initial plugins may normalize an explicitly documented input representation. For example, built-in `looseBoolean()` accepts `boolean | "true" | "false"` and outputs `boolean`; it does not perform unrestricted truthiness coercion.

## Async and thenable work

Step callbacks may return direct or supported `PromiseLike` values according to their declared contract.

```ts
addSuccessStep(async (value) => {
	const available = await repository.isAvailable(value)
	return available
		? success(value)
		: failure(createIssue({
			code: 'isAvailable:unavailable',
			payload: { value },
			defaultMessage: 'Value is unavailable.',
		}))
})
```

A callback-driven pipeline can be maybe-async because an earlier synchronous failure may prevent the callback from running. Users can append `.toAsync()` when every invocation must return a native promise.

## Recovery plugins

Use `addFailureStep()` only when the step is intentionally a recovery or flow-control operation:

```ts
addFailureStep(issues => success(createReplacement(issues)))
```

Do not use failure recovery to conceal ordinary validation constraints.

## Implementation utilities

The method implementation receives utilities such as:

| Utility | Purpose |
| --- | --- |
| `addSuccessStep(fn)` | Run work while the pipeline is successful |
| `addFailureStep(fn)` | Run recovery work while the pipeline is failed |
| `success(value)` | Produce a successful step result |
| `failure(issueOrIssues)` | Produce a failed step result |
| `createIssue(options)` | Resolve and create a structured issue |

Only root exports from `@valchecker/internal` are supported plugin API. Package-private source paths and unexported runtime helpers are not semver-covered.

## Testing requirements

Every built-in contribution should include:

- success and failure cases,
- exact issue code, payload, path, and default message,
- custom message handling,
- state-aware method availability,
- output inference for transformations,
- synchronous, asynchronous, and early-failure paths where relevant,
- edge cases matching the documented runtime grammar,
- a benchmark file,
- 100% implementation coverage.

Example:

```ts
import { createValchecker, number } from 'valchecker'
import { describe, expect, it } from 'vitest'
import { isPositive } from './isPositive'

const v = createValchecker({ steps: [number, isPositive] })

describe('isPositive', () => {
	it('accepts positive numbers', () => {
		expect(v.number().isPositive().execute(1))
			.toEqual({ value: 1 })
	})

	it('returns a structured issue', () => {
		expect(v.number().isPositive().execute(0))
			.toEqual({
				issues: [{
					code: 'isPositive:expected_positive',
					message: 'Expected a positive number.',
					path: [],
					payload: { value: 0 },
				}],
			})
	})
})
```

## Repository integration checklist

When contributing a built-in step:

1. implement the plugin and tree-shaking annotation,
2. add focused tests and benchmarks,
3. export it from `packages/internal/src/steps/index.ts`,
4. update `api-surface.json`,
5. update both README files and every relevant VitePress page,
6. update repository agent skills and references,
7. update changelog and migration documentation for public changes,
8. run build, lint, typecheck, full coverage, installed-consumer tests, docs build, and relevant benchmarks,
9. search the entire repository for superseded public names and issue codes.

`allSteps` discovers exported plugin objects through the runtime marker; do not manually maintain a duplicate static list.

## Plugin name restrictions

A plugin method name must:

- be a string,
- map to a function implementation,
- be unique among registered steps,
- not collide with a core schema method,
- not be `then`.

Symbol method names are rejected so schemas cannot accidentally become promise-like or produce inconsistent method registration.

## Issue and message finalization

`createIssue()` creates an internal issue draft. Do not resolve or cache user-facing messages yourself. Nested structures finish `path` and optional `context`, and Valchecker resolves the message exactly once when `execute()` or `~standard.validate()` returns publicly.

A structure plugin that intentionally provides a message scope for delegated child issues may pass that handler as the third argument to `prependIssuePath(issue, path, message)`. The nearest enclosing scope wins. This is advanced infrastructure behavior; ordinary validation plugins should use `createIssue()` only.

Registered plugin issues are collected through `Meta.SelfIssue`, which is why a selective instance's global message callback and message map can provide exact issue-code and payload autocomplete. Dynamic issues created only inside a later schema cannot retroactively alter the global handler type of an existing Valchecker instance.
