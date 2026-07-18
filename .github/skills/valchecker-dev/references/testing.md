# Testing Guide

Built-in step implementations require 100% coverage and exact contract assertions.

## Required coverage

Test:

- successful and failed execution,
- every runtime branch and boundary,
- exact issue code, payload, path, and default message,
- static and callback custom messages,
- state-aware chaining availability,
- transformed output inference,
- synchronous, asynchronous, thenable, and early-failure behavior where relevant,
- tree-shaking-sensitive export behavior,
- documented TypeScript-compatible loose primitive grammar.

## Validation-step template

```ts
import { describe, expect, it } from 'vitest'
import { createValchecker, isAtLeast, number } from '../..'

const v = createValchecker({ steps: [number, isAtLeast] })

describe('isAtLeast step plugin', () => {
	it('accepts the boundary', () => {
		expect(v.number().isAtLeast(0).execute(0))
			.toEqual({ value: 0 })
	})

	it('accepts values above the boundary', () => {
		expect(v.number().isAtLeast(0).execute(5))
			.toEqual({ value: 5 })
	})

	it('returns the exact issue', () => {
		expect(v.number().isAtLeast(0).execute(-1))
			.toEqual({
				issues: [{
					code: 'isAtLeast:expected_at_least',
					message: 'Expected a value of at least 0.',
					path: [],
					payload: {
						target: 'number',
						value: -1,
						minimum: 0,
					},
				}],
			})
	})

	it('uses a custom message', () => {
		expect(v.number().isAtLeast(0, { message: 'Must be non-negative' }).execute(-1))
			.toMatchObject({
				issues: [{ message: 'Must be non-negative' }],
			})
	})

	it('passes the typed payload to message handlers', () => {
		const schema = v.number().isAtLeast(0, { message: ({ payload }) =>
				`Expected ${payload.minimum}; received ${payload.value}` }
		)

		expect(schema.execute(-1)).toMatchObject({
			issues: [{ message: 'Expected 0; received -1' }],
		})
	})
})
```

## Primitive identity tests

Primitive tests must match TypeScript and JavaScript identity exactly:

```ts
it.each([0, -0, 1.5, Number.NaN, Infinity, -Infinity])(
	'accepts JavaScript number %s',
	(value) => {
		expect(v.number().execute(value)).toEqual({ value })
	},
)
```

Do not accidentally reintroduce finite-number policy into `number()`.

## Loose primitive grammar

Runtime fixtures must stay aligned with TypeScript template-literal expectations.

```ts
it.each([
	['1e3', 1000],
	['0x10', 16],
	[' 1 ', 1],
])('normalizes %p', (input, output) => {
	expect(v.looseNumber().execute(input)).toEqual({ value: output })
})

it.each(['', 'NaN', 'Infinity', 'invalid'])(
	'rejects unsupported number string %p',
	(value) => {
		expect(v.looseNumber().execute(value)).toMatchObject({
			issues: [{ code: 'looseNumber:expected_number' }],
		})
	},
)
```

Also test primitive pass-through, such as numeric `NaN` and infinity for `looseNumber()`.

## Chaining tests

Test the method in realistic chains and prove that each named validation enforces only its own condition:

```ts
expect(v.number().isAtLeast(0).execute(Infinity))
	.toEqual({ value: Infinity })

expect(v.number().isFinite().isAtLeast(0).execute(Infinity))
	.toMatchObject({
		issues: [{ code: 'isFinite:expected_finite' }],
	})
```

Length and numeric bounds are separate plugins and require separate state-availability tests.

## Transformation tests

Assert both runtime output and inferred next-step availability:

```ts
const schema = v.string().toSplit(',').toLength()

expect(schema.execute('a,b,c')).toEqual({ value: 3 })
```

JSON transformations must test success, syntax failure, unsupported values, circular structures, and custom messages.

## Async tests

A callback-driven schema can be maybe-async:

```ts
const schema = v.string().check(async value => value.length > 0)

expect(schema.execute(42)).toMatchObject({
	issues: [{ code: 'string:expected_string' }],
})

await expect(schema.execute('value')).resolves.toEqual({ value: 'value' })
```

For `.toAsync()`, assert that synchronous success and early failure both return native promises:

```ts
const schema = v.string().toAsync()
const result = schema.execute(42)

expect(result).toBeInstanceOf(Promise)
await expect(result).resolves.toMatchObject({ issues: expect.any(Array) })
```

Use `execute()`; there is no `runAsync()` method.

## Result assertions

Prefer complete `toEqual()` assertions for stable public contracts. Use `toMatchObject()` only when a payload contains intentionally unstable objects such as a caught `SyntaxError`.

Avoid inverted checks such as asserting `'issues' in result` is false in a failure test.

## Running tests

```bash
pnpm test
pnpm test --coverage
pnpm test packages/internal/src/steps/isFinite
pnpm typecheck
```

Before merging a public API change, also run build, lint, installed-consumer tests, docs build, API surface check, and relevant benchmarks.

## Review checklist

- No skipped tests.
- New implementation files are fully covered.
- Old public names and issue codes are absent except in explicit migration examples.
- Default and selective instances both expose the intended methods.
- `api-surface.json` matches generated output.
- Tests do not depend on implementation-only source paths.
- Benchmark fixtures compile against the same public API.