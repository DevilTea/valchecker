# Implementation Examples

These examples follow the current trailing-options, issue-draft, and operation-mode contracts. Built-in contributions must also follow the repository conventions, tests, benchmarks, and public API checklist.

## Synchronous validation plugin

```ts
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
	SelfIssue: ExecutionIssue<'isPositive:expected_positive', { value: number }>
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
	 * const schema = v.number().isPositive()
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
		addSuccessStep(value => value > 0
			? success(value)
			: failure(createIssue({
				code: 'isPositive:expected_positive',
				payload: { value },
				customMessage: options?.message,
				defaultMessage: 'Expected a positive number.',
			})))
	},
}, 'sync')
```

`createIssue()` is checked against `Meta.SelfIssue`; an invalid code, category, or payload fails typechecking.

## Parameterized validation

Keep the required semantic operand positional and put optional configuration plus `message` in one trailing object:

```ts
type Options = StepOptions<Meta['SelfIssue']>

// PluginDef method
(divisor: number, options?: Options) => Next<
	{ issue: Meta['SelfIssue'] },
	this['CurrentValchecker']
>

// Runtime params
params: [divisor, options]
```

Snapshot caller-owned mutable configuration at construction when later mutation could change validation.

## Pure transformation

A transformation with no owned issue omits `SelfIssue` and patches the output:

```ts
interface PluginDef extends TStepPluginDef {
	/** canonical Description / Example / Issues JSDoc */
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
		addSuccessStep(
			value => success([...value].map(character => character.codePointAt(0)!)),
		)
	},
}, 'sync')
```

Do not generalize this into “transforms never fail.” Native conversions, serialization, and callback transforms own issues where their operation can fail.

## Callback operation issue

Thrown or rejected user/native callback work uses category `operation`:

```ts
type CallbackIssue = ExecutionIssue<
	'toDomain:callback_failed',
	{ phase: 'throw' | 'reject', value: Input, error: unknown },
	'operation'
>
```

Pass `category: 'operation'` to `createIssue()` for that code. The callback's ordinary negative result, when supported, is a separate validation contract.

## Recovery plugin

Recovery steps must preserve internal failures as fatal:

```ts
addFailureStep((issues) => {
	if (issues.some(issue => issue.category === 'internal'))
		return failure(issues)
	return success(createReplacement(issues))
})
```

Use the package-private recovery helpers available to built-in source where appropriate; application/plugin examples should rely on public issue categories rather than issue-code strings.

## Structural issue propagation

```ts
const propagated = prependIssuePath(childIssue, [key], options?.message)
const withBranch = appendIssueContext(propagated, {
	type: 'union',
	branchIndex,
})
```

Use `replaceIssuePath()` when a structure maps a child path to an absolute path, such as a tuple rest region. Never spread a draft issue on a propagation path.

## Registration

```ts
import { createValchecker, number } from 'valchecker'
import { isPositive } from './isPositive'

const v = createValchecker({ steps: [number, isPositive] })
const schema = v.number().isPositive()
```

Add built-ins through the normal export barrels. `allSteps` discovers runtime-marked plugins automatically.
