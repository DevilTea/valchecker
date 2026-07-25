# Custom Steps

Custom step plugins extend Valchecker's state-aware fluent API while preserving runtime behavior, output and issue inference, operation mode, and tree-shaking.

Use a custom plugin for a reusable domain operation that deserves a named fluent method. Prefer `check()` or `transform()` for one-off callback logic.

## Naming and issue contracts

Follow built-in conventions when they fit:

- initial schemas use nouns or noun phrases,
- validations use natural `isXxx` propositions,
- concrete transformations use `toXxx`,
- generic or flow-control operations use the most direct verb.

Issue codes use the public method name:

```text
<public-step-name>:<snake_case_description>
```

`ExecutionIssue<'code', Payload>` defaults to category `validation`. Pass the third generic argument for `operation` or `internal` issues.

## Plugin architecture

A normal plugin has three layers:

1. `Meta` declares the public method name, valid current schema state, and issues owned by the method.
2. `PluginDef` declares the state-aware TypeScript signature and public JSDoc.
3. `implStepPlugin()` registers construction-time behavior and the default operation mode.

## Synchronous validation example

````ts
import type {
	DefineExpectedValchecker,
	DefineStepMethod,
	DefineStepMethodMeta,
	ExecutionIssue,
	Next,
	StepOptions,
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
	 * ### Description:
	 * Checks that the number is greater than zero.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * const schema = v.number()
	 * 	.isPositive()
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isPositive:expected_positive'`: The number is not positive.
	 */
	isPositive: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (options?: StepOptions<Meta['SelfIssue']>) => Next<
				{ issue: Meta['SelfIssue'] },
				this['CurrentValchecker']
			>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isPositive = implStepPlugin<PluginDef>({
	isPositive: ({
		utils: { addSuccessStep, createIssue, failure, success },
		params: [options],
	}) => {
		addSuccessStep((value) => {
			if (value <= 0) {
				return failure(createIssue({
					code: 'isPositive:expected_positive',
					payload: { value },
					customMessage: options?.message,
					defaultMessage: 'Expected a positive number.',
				}))
			}

			return success(value)
		})
	},
}, 'sync')
````

Register the plugin with the initial step it depends on:

```ts
import { createValchecker, number } from 'valchecker'
import { isPositive } from './isPositive'

const v = createValchecker({ steps: [number, isPositive] })
const schema = v.number()
	.isPositive()
```

## Parameters

A message-bearing method keeps at most one required semantic operand positional. Optional configuration and `message` belong to one trailing options object.

```ts
type Options = StepOptions<Meta['SelfIssue']>

// PluginDef method
(divisor: number, options?: Options) => Next<
	{ issue: Meta['SelfIssue'] },
	this['CurrentValchecker']
>

// Runtime parameters
params: [divisor, options]
```

Do not use direct positional messages. Snapshot mutable caller-owned configuration at schema construction when later mutation could alter validation.

## Transformation example

A pure transformation patches the output and owns no issue:

````ts
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
	/**
	 * ### Description:
	 * Converts the string to Unicode code points.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * const schema = v.string().toCodePoints()
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None.
	 */
	toCodePoints: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? () =>
				Next<
					{ output: number[] },
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toCodePoints = implStepPlugin<PluginDef>({
	toCodePoints: ({ utils: { addSuccessStep, success } }) => {
		addSuccessStep(
			value => success([...value].map(character => character.codePointAt(0)!)),
		)
	},
}, 'sync')
````

Do not generalize this into “transformations cannot fail.” Callback transforms, native conversions, parsing, and serialization may own validation or operation issues.

## Async and operation modes

`implStepPlugin()` defaults unannotated plugins to `maybe-async`. Pass `'sync'` only when every registration inheriting the default cannot return a thenable. Individual `addStep()`, `addSuccessStep()`, and `addFailureStep()` registrations may override the mode with `'sync'`, `'maybe-async'`, or `'async'`.

A callback-driven pipeline may still return a direct early failure before asynchronous work is reached. Users can append `.toAsync()` when every invocation must return a native promise.

## Callback operation issues

A thrown or rejected user/native callback is an `operation` issue:

```ts
type CallbackIssue = ExecutionIssue<
	'toDomain:callback_failed',
	{ phase: 'throw' | 'reject', value: Input, error: unknown },
	'operation'
>
```

Pass `category: 'operation'` to `createIssue()` for that code. The code, category, and payload are checked against the current method's `Meta.SelfIssue`.

## Recovery plugins

Use `addFailureStep()` only for an intentional recovery or flow-control operation. Internal issues are fatal and must not be hidden:

```ts
addFailureStep((issues) => {
	if (issues.some(issue => issue.category === 'internal'))
		return failure(issues)
	return success(createReplacement(issues))
})
```

## Issue drafts and propagation

`createIssue()` creates an internal draft. It does not eagerly execute dynamic message handlers. Nested structures finish `path`, optional `context`, and enclosing message scopes; public `execute()` and Standard Schema validation finalize the issue exactly once.

Use the issue utilities supplied through `utils`:

- `prependIssuePath(issue, path, messageScope?)`
- `replaceIssuePath(issue, path, messageScope?)`
- `appendIssueContext(issue, context)`

Do not spread a draft issue on a propagation path. Its unresolved message metadata is stored on a non-enumerable symbol and would be lost.

## Construction metadata

`setMetadata(key, value)` writes symbol-keyed final-step metadata to `~core.metadata`. A fresh construction utility object is created for each fluent call, so the next step drops metadata unless it explicitly writes it again.

The declaring module owns the symbol and any required snapshot or freeze of mutable metadata. Package-private symbols are not barrel-exported.

## Supported plugin API

Use only root exports from `@valchecker/internal`. Package-private source paths and unexported runtime helpers are not semver-covered.

A plugin method name must:

- be a string,
- map to a function implementation,
- be unique among registered methods,
- not collide with a core schema method,
- not be `then`.

Symbol method names are rejected.

## Testing and repository integration

A built-in contribution must protect its observable contracts in the owning test layers:

- distinct success and failure semantics,
- every owned issue code, category, payload, default message, and custom message,
- exact boundaries and relevant JavaScript edge cases,
- output and issue inference,
- operation mode and fluent method availability,
- async, ordering, collect-all, or early-failure behavior only where applicable,
- a representative benchmark file.

Coverage is a guardrail, not the test plan. Do not add fixtures solely to execute uncovered lines.

When adding or changing a built-in step:

1. update implementation, colocated tests, benchmark, and local export;
2. export it from `packages/internal/src/steps/index.ts`;
3. update and verify `api-surface.json` for intentional public export changes;
4. verify default and selective instances and relevant tree-shaking scenarios;
5. update README, VitePress, skills, changelog, and migration material where applicable;
6. run the repository checks required by `AGENTS.md` and the development skill.

`allSteps` discovers exported plugin objects through the runtime marker. Do not maintain a duplicate static list.
