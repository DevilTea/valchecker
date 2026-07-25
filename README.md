# valchecker

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]

> Runtime-first validation with zero guesswork

A modular ESM-only TypeScript validation library with immutable fluent steps, transformed-output inference, structured non-empty issues, sync/maybe-async execution, Standard Schema V1, and selective tree-shakable plugin registration.

## Requirements and installation

- Node.js 22 or newer
- ESM; CommonJS may use dynamic `import('valchecker')`

```bash
pnpm add valchecker
# or
npm install valchecker
```

## Quick start

```ts
import { v } from 'valchecker'

const userSchema = v.object({
	name: v.string().toTrimmed().isNotEmpty(),
	email: v.string().toLowercase().isEmail(),
	age: v.looseNumber().isFinite().isInteger().isAtLeast(0),
	nickname: [v.string()],
})

const result = await userSchema.execute({
	name: '  Alice  ',
	email: 'ALICE@EXAMPLE.COM',
	age: '25',
})

if (v.isSuccess(result))
	console.log(result.value)
else
	console.error(result.issues)
```

Every fluent method returns a new reusable schema. One-element tuples mark object fields optional and materialize `undefined` when absent.

## Selective registration

The default `v` includes every built-in step. Bundle-sensitive applications can register only what they use:

```ts
import { createValchecker, isAtLeast, isFinite, number } from 'valchecker'

const v = createValchecker({ steps: [number, isFinite, isAtLeast] })
```

`allSteps` is available for custom complete instances and is derived from runtime-marked public plugin exports rather than a duplicate static list.

## Core semantics

- Initial schemas use nouns: `string()`, `number()`, `object()`, `looseBoolean()`.
- Built-in validations use `isXxx()` and preserve successful values.
- Concrete transformations use `toXxx()` and change representation.
- Generic escape hatches remain `check()` and `transform()`.

`number()` accepts every JavaScript number, including `NaN` and infinities. Add `isFinite()` when finite values are required. A named validation enforces only its stated condition; for example, `isAtLeast(0)` accepts positive infinity.

Loose primitives accept the primitive or the corresponding TypeScript-template-compatible string representation and normalize the output. They do not perform unrestricted JavaScript coercion.

Native conversion steps delegate to JavaScript:

```ts
v.string().toNumber() // Number(value)
v.unknown().toBoolean() // Boolean(value)
v.string().toBigint() // BigInt(value)
```

Use explicit policy steps such as `toSafeNumber()` and `toMappedBoolean()` when narrower semantics are required.

## Structures and composition

- `object()` omits unknown output properties.
- `strictObject()` rejects unknown enumerable own string and symbol keys.
- `looseObject()` preserves unknown own properties.
- Arrays, tuples, Sets, Maps, and records validate and transform nested values.
- `union()` returns the first successful branch.
- `variant()` dispatches directly from an own discriminator.
- `intersection()` composes compatible branch outputs.

Set and Map schemas preserve insertion order and reject duplicate transformed items or keys rather than silently losing data.

Use `use()` for schema delegation and `fallback()` for documented recovery. `fallback()` recovers validation and operation failures only; internal issues are fatal.

## Execution and results

A synchronous pipeline returns directly. A callback-driven schema may return a promise only when asynchronous work is reached; an earlier failure can remain synchronous. Awaiting either mode is safe. Append `.toAsync()` when every call must return a native promise.

```ts
type ExecutionResult<Value, Issue>
	= | { value: Value }
		| { issues: [Issue, ...Issue[]] }

interface Issue {
	code: string
	category: 'validation' | 'operation' | 'internal'
	payload: unknown
	message: string
	path: PropertyKey[]
	context?: Array<{ type: string, [key: string]: unknown }>
}
```

Use codes, categories, paths, context, and payloads for machine behavior rather than parsing messages.

Message priority is step message, nearest enclosing structure, outer structures, originating instance global resolver, step default, then `"Invalid value."`.

## Type inference and packages

```ts
import type { InferInput, InferOutput } from 'valchecker'

type Input = InferInput<typeof userSchema>
type Output = InferOutput<typeof userSchema>
```

| Package | Purpose |
| --- | --- |
| `valchecker` | application API, default `v`, built-ins and helpers |
| `@valchecker/all-steps` | complete runtime-marked plugin collection |
| `@valchecker/internal` | semver-covered advanced types and plugin author API |

Every schema exposes `~standard` for Standard Schema V1 integrations. Public exports are recorded in `api-surface.json`.

## Documentation

- [Quick Start](https://deviltea.github.io/valchecker/guide/quick-start)
- [Valchecker 1.0 Contract](https://deviltea.github.io/valchecker/guide/v1-contract)
- [Migrating to 1.0](https://deviltea.github.io/valchecker/guide/migration-to-1)
- [Custom Steps](https://deviltea.github.io/valchecker/guide/custom-steps)
- [API Reference](https://deviltea.github.io/valchecker/api/overview)
- [Complete migration guide](./MIGRATION.md)
- [Support policy](./SUPPORT.md)
- [Contributing](./CONTRIBUTING.md)
- [Release process](./RELEASING.md)

## Development

```bash
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` is the complete gate and runs the same commands as CI. See
[Contributing](./CONTRIBUTING.md) before opening a pull request.

## License

[MIT](./LICENSE) License © 2025-PRESENT [DevilTea](https://github.com/DevilTea)

[npm-version-src]: https://img.shields.io/npm/v/valchecker?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/valchecker
[npm-downloads-src]: https://img.shields.io/npm/dm/valchecker?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/valchecker
[license-src]: https://img.shields.io/github/license/DevilTea/valchecker.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/DevilTea/valchecker/blob/main/LICENSE
